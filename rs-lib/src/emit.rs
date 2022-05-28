// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use deno_ast::get_syntax;
use deno_ast::swc;
use deno_ast::swc::common::comments::SingleThreadedComments;
use deno_ast::swc::common::FileName;
use deno_ast::swc::common::Mark;
use deno_ast::swc::common::SourceMap;
use deno_ast::swc::common::Spanned;
use deno_ast::swc::parser::error::Error as SwcError;
use deno_ast::swc::parser::lexer::Lexer;
use deno_ast::swc::parser::StringInput;
use deno_ast::Diagnostic;
use deno_ast::EmitOptions;
use deno_ast::LineAndColumnDisplay;
use deno_ast::MediaType;
use deno_ast::ModuleSpecifier;
use deno_ast::SourceRangedForSpanned;
use std::collections::HashMap;
use std::rc::Rc;

use crate::bundle_hook::BundleHook;
use crate::text::strip_bom;

const IGNORE_DIRECTIVES: &[&str] = &[
  "// deno-fmt-ignore-file",
  "// deno-lint-ignore-file",
  "// This code was bundled using `deno bundle` and it's not recommended to edit it manually",
];

pub enum BundleType {
  /// Return the emitted contents of the program as a single "flattened" ES
  /// module.
  Module,
  /// Return the emitted contents of the program as a single script that
  /// executes the program using an immediately invoked function execution
  /// (IIFE).
  Classic,
}

impl From<BundleType> for swc::bundler::ModuleType {
  fn from(bundle_type: BundleType) -> Self {
    match bundle_type {
      BundleType::Classic => Self::Iife,
      BundleType::Module => Self::Es,
    }
  }
}

pub struct BundleOptions {
  pub bundle_type: BundleType,
  pub emit_options: EmitOptions,
  pub emit_ignore_directives: bool,
}

#[derive(Debug)]
pub struct BundleEmit {
  pub code: String,
  pub maybe_map: Option<String>,
}

struct BundleLoader<'a> {
  cm: Rc<swc::common::SourceMap>,
  emit_options: &'a EmitOptions,
  graph: &'a deno_graph::ModuleGraph,
}

impl swc::bundler::Load for BundleLoader<'_> {
  fn load(
    &self,
    file_name: &swc::common::FileName,
  ) -> Result<swc::bundler::ModuleData> {
    match file_name {
      swc::common::FileName::Url(specifier) => {
        if let Some(m) = self.graph.get(specifier) {
          let (fm, module) = transpile_module(
            specifier,
            m.maybe_source.as_ref().map(|s| s as &str).unwrap_or(""),
            m.media_type,
            self.emit_options,
            self.cm.clone(),
          )?;
          Ok(swc::bundler::ModuleData {
            fm,
            module,
            helpers: Default::default(),
          })
        } else {
          Err(anyhow!(
            "Module \"{}\" unexpectedly missing when bundling.",
            specifier
          ))
        }
      }
      _ => unreachable!(
        "Received a request for unsupported filename {:?}",
        file_name
      ),
    }
  }
}

struct BundleResolver<'a>(&'a deno_graph::ModuleGraph);

impl swc::bundler::Resolve for BundleResolver<'_> {
  fn resolve(
    &self,
    referrer: &swc::common::FileName,
    specifier: &str,
  ) -> Result<swc::common::FileName> {
    let referrer = if let swc::common::FileName::Url(referrer) = referrer {
      referrer
    } else {
      unreachable!(
        "An unexpected referrer was passed when bundling: {:?}",
        referrer
      );
    };
    if let Some(specifier) =
      self.0.resolve_dependency(specifier, referrer, false)
    {
      Ok(deno_ast::swc::common::FileName::Url(specifier.clone()))
    } else {
      Err(anyhow!(
        "Cannot resolve \"{}\" from \"{}\".",
        specifier,
        referrer
      ))
    }
  }
}

/// Given a module graph, generate and return a bundle of the graph and
/// optionally its source map in memory.
pub fn bundle_graph(
  graph: &deno_graph::ModuleGraph,
  options: BundleOptions,
) -> Result<BundleEmit> {
  let globals = swc::common::Globals::new();
  deno_ast::swc::common::GLOBALS.set(&globals, || {
    let source_map_config = deno_ast::SourceMapConfig {
      inline_sources: options.emit_options.inline_sources,
    };

    let cm = Rc::new(swc::common::SourceMap::new(
      swc::common::FilePathMapping::empty(),
    ));
    let loader = BundleLoader {
      graph,
      emit_options: &options.emit_options,
      cm: cm.clone(),
    };
    let resolver = BundleResolver(graph);
    let config = swc::bundler::Config {
      module: options.bundle_type.into(),
      ..Default::default()
    };
    // This hook will rewrite the `import.meta` when bundling to give a consistent
    // behavior between bundled and unbundled code.
    let hook = Box::new(BundleHook);
    let mut bundler = swc::bundler::Bundler::new(
      &globals,
      cm.clone(),
      loader,
      resolver,
      config,
      hook,
    );
    let mut entries = HashMap::new();
    entries.insert(
      "bundle".to_string(),
      swc::common::FileName::Url(graph.roots[0].0.clone()),
    );
    let output = bundler
      .bundle(entries)
      .context("Unable to output during bundling.")?;
    let mut buf = Vec::new();
    let mut srcmap = Vec::new();
    {
      let cfg = swc::codegen::Config {
        minify: false,
        ascii_only: false,
        target: deno_ast::ES_VERSION,
      };
      let mut wr = Box::new(swc::codegen::text_writer::JsWriter::new(
        cm.clone(),
        "\n",
        &mut buf,
        Some(&mut srcmap),
      ));

      if options.emit_ignore_directives {
        // write leading comments in bundled file
        use swc::codegen::text_writer::WriteJs;
        let cmt = IGNORE_DIRECTIVES.join("\n") + "\n\n";
        wr.write_comment(&cmt)?;
      }

      let mut emitter = swc::codegen::Emitter {
        cfg,
        cm: cm.clone(),
        comments: None,
        wr,
      };
      emitter
        .emit_module(&output[0].module)
        .context("Unable to emit during bundling.")?;
    }
    let mut code =
      String::from_utf8(buf).context("Emitted code is an invalid string.")?;
    let mut maybe_map: Option<String> = None;
    {
      let mut buf = Vec::new();
      cm.build_source_map_with_config(&mut srcmap, None, source_map_config)
        .to_writer(&mut buf)?;
      if options.emit_options.inline_source_map {
        let encoded_map = format!(
          "//# sourceMappingURL=data:application/json;base64,{}\n",
          base64::encode(buf)
        );
        code.push_str(&encoded_map);
      } else if options.emit_options.source_map {
        maybe_map = Some(String::from_utf8(buf)?);
      }
    }

    Ok(BundleEmit { code, maybe_map })
  })
}

/// Transpiles a source module into an swc SourceFile.
fn transpile_module(
  specifier: &ModuleSpecifier,
  source: &str,
  media_type: MediaType,
  options: &deno_ast::EmitOptions,
  cm: Rc<swc::common::SourceMap>,
) -> Result<(Rc<swc::common::SourceFile>, swc::ast::Module)> {
  let source = strip_bom(source);
  let source = if media_type == MediaType::Json {
    format!(
      "export default JSON.parse(`{}`);",
      source.replace("${", "\\${").replace('`', "\\`")
    )
  } else {
    source.to_string()
  };
  let source_file =
    cm.new_source_file(FileName::Url(specifier.clone()), source);
  let input = StringInput::from(&*source_file);
  let comments = SingleThreadedComments::default();
  let syntax = if media_type == MediaType::Json {
    get_syntax(MediaType::JavaScript)
  } else {
    get_syntax(media_type)
  };
  let lexer = Lexer::new(syntax, deno_ast::ES_VERSION, input, Some(&comments));
  let mut parser = swc::parser::Parser::new_from(lexer);
  let module = parser
    .parse_module()
    .map_err(|e| swc_err_to_diagnostic(&cm, specifier, e))?;
  let diagnostics = parser
    .take_errors()
    .into_iter()
    .map(|e| swc_err_to_diagnostic(&cm, specifier, e))
    .collect::<Vec<_>>();

  let top_level_mark = Mark::fresh(Mark::root());
  let program = deno_ast::fold_program(
    swc::ast::Program::Module(module),
    options,
    cm,
    &comments,
    top_level_mark,
    &diagnostics,
  )?;
  let module = match program {
    swc::ast::Program::Module(module) => module,
    _ => unreachable!(),
  };

  Ok((source_file, module))
}

fn swc_err_to_diagnostic(
  source_map: &SourceMap,
  specifier: &ModuleSpecifier,
  err: SwcError,
) -> Diagnostic {
  let location = source_map.lookup_char_pos(err.span().lo);
  Diagnostic {
    specifier: specifier.to_string(),
    range: err.range(),
    display_position: LineAndColumnDisplay {
      line_number: location.line,
      column_number: location.col_display + 1,
    },
    kind: err.into_kind(),
  }
}
