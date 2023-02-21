// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

use anyhow::anyhow;
use anyhow::Context;
use anyhow::Result;
use deno_ast::get_syntax;
use deno_ast::swc;
use deno_ast::swc::common::comments::SingleThreadedComments;
use deno_ast::swc::common::FileName;
use deno_ast::swc::common::Mark;
use deno_ast::swc::parser::lexer::Lexer;
use deno_ast::swc::parser::StringInput;
use deno_ast::Diagnostic;
use deno_ast::EmitOptions;
use deno_ast::MediaType;
use deno_ast::ModuleSpecifier;
use deno_ast::SourceTextInfo;
use deno_graph::Module;
use std::collections::HashMap;
use std::rc::Rc;

use crate::bundle_hook::BundleHook;
use crate::text::strip_bom;
use crate::text::transform_json_source;

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
        match self.graph.get(specifier) {
          Some(Module::Esm(m)) => {
            let (fm, module) = transpile_module(
              specifier,
              &m.source,
              m.media_type,
              self.emit_options,
              self.cm.clone(),
            )?;
            Ok(swc::bundler::ModuleData {
              fm,
              module,
              helpers: Default::default(),
            })
          }
          Some(_) => {
            Err(anyhow!(
              "Module \"{}\" was an unsupported module kind.",
              specifier
            ))
          }
          None => {
            Err(anyhow!(
              "Module \"{}\" unexpectedly missing when bundling.",
              specifier
            ))
          }
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
      swc::common::FileName::Url(graph.roots[0].clone()),
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
        omit_last_semi: false,
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
    let mut code = shebang_file(graph)
      .map(|shebang| format!("{shebang}\n"))
      .unwrap_or_default();
    code.push_str(
      &String::from_utf8(buf).context("Emitted code is an invalid string.")?,
    );
    let mut maybe_map: Option<String> = None;
    {
      let mut buf = Vec::new();
      cm.build_source_map_with_config(&srcmap, None, source_map_config)
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

fn shebang_file(graph: &deno_graph::ModuleGraph) -> Option<String> {
  let module = graph.get(graph.roots.get(0)?)?.esm()?;
  let first_line = module.source.lines().next()?;
  if first_line.starts_with("#!") {
    Some(first_line.to_string())
  } else {
    None
  }
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
    transform_json_source(source)
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
  let module = parser.parse_module().map_err(|e| {
    Diagnostic::from_swc_error(
      e,
      specifier.as_str(),
      SourceTextInfo::from_string(source_file.src.to_string()),
    )
  })?;
  let diagnostics = {
    let diagnostics = parser.take_errors();
    if diagnostics.is_empty() {
      Vec::new()
    } else {
      let info = SourceTextInfo::from_string(source_file.src.to_string());
      diagnostics
        .into_iter()
        .map(|e| {
          Diagnostic::from_swc_error(e, specifier.as_str(), info.clone())
        })
        .collect::<Vec<_>>()
    }
  };

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

#[cfg(test)]
mod test {
  use deno_ast::ModuleSpecifier;
  use deno_graph::source::MemoryLoader;
  use deno_graph::source::Source;
  use deno_graph::BuildOptions;
  use deno_graph::CapturingModuleAnalyzer;
  use deno_graph::ModuleGraph;
  use pretty_assertions::assert_eq;

  use crate::bundle_graph;
  use crate::BundleOptions;

  async fn setup<S: AsRef<str> + Copy>(
    root: S,
    sources: Vec<(S, S)>,
  ) -> (ModuleGraph, CapturingModuleAnalyzer, ModuleSpecifier) {
    let sources = sources
      .into_iter()
      .map(|(s, c)| {
        (
          s,
          Source::Module {
            specifier: s,
            maybe_headers: None,
            content: c,
          },
        )
      })
      .collect();
    let mut memory_loader = MemoryLoader::new(sources, vec![]);
    let root = ModuleSpecifier::parse(root.as_ref()).unwrap();
    let analyzer = CapturingModuleAnalyzer::default();
    let mut graph = ModuleGraph::default();
    graph
      .build(
        vec![root.clone()],
        &mut memory_loader,
        BuildOptions {
          module_analyzer: Some(&analyzer),
          ..Default::default()
        },
      )
      .await;
    (graph, analyzer, root)
  }

  #[tokio::test]
  async fn bundle_shebang_file() {
    let input = concat!(
      "#!/usr/bin/env -S deno run --allow-read\n",
      "console.log(5)",
    );
    let graph = setup("file:///test.ts", vec![("file:///test.ts", input)])
      .await
      .0;

    let output = bundle_graph(
      &graph,
      BundleOptions {
        bundle_type: crate::BundleType::Module,
        emit_ignore_directives: false,
        emit_options: Default::default(),
      },
    )
    .unwrap();
    assert_eq!(&output.code[..input.len()], input);
  }
}
