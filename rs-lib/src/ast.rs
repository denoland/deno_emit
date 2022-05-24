// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

use crate::text;
use crate::transforms;

use anyhow::Result;
use deno_ast::get_syntax;
use deno_ast::swc::ast::Module;
use deno_ast::swc::ast::Program;
use deno_ast::swc::common::chain;
use deno_ast::swc::common::comments::SingleThreadedComments;
use deno_ast::swc::common::source_map::SourceMapGenConfig;
use deno_ast::swc::common::FileName;
use deno_ast::swc::common::Mark;
use deno_ast::swc::common::SourceMap;
use deno_ast::swc::common::Spanned;
use deno_ast::swc::parser::lexer::Lexer;
use deno_ast::swc::parser::StringInput;
use deno_ast::swc::transforms::fixer;
use deno_ast::swc::transforms::helpers;
use deno_ast::swc::transforms::hygiene;
use deno_ast::swc::transforms::pass::Optional;
use deno_ast::swc::transforms::proposals;
use deno_ast::swc::transforms::react;
use deno_ast::swc::transforms::resolver_with_mark;
use deno_ast::swc::transforms::typescript;
use deno_ast::swc::visit::FoldWith;
use deno_ast::Diagnostic;
use deno_ast::LineAndColumnDisplay;
use deno_ast::ModuleSpecifier;
use deno_graph::MediaType;
use std::rc::Rc;

pub enum ImportsNotUsedAsValues {
  Remove,
  Preserve,
  Error,
}

/// This is a deserializable structure of the `"compilerOptions"` section of a
/// TypeScript or Deno configuration file which can effect how the emitting is
/// handled, all other options don't impact the output.
#[cfg_attr(feature = "serialization", derive(serde::Deserialize))]
#[cfg_attr(feature = "serialization", serde(default, rename_all = "camelCase"))]
#[derive(Debug)]
pub struct CompilerOptions {
  pub check_js: bool,
  pub emit_decorator_metadata: bool,
  pub imports_not_used_as_values: String,
  pub inline_source_map: bool,
  pub inline_sources: bool,
  pub jsx: String,
  pub jsx_factory: String,
  pub jsx_fragment_factory: String,
  pub source_map: bool,
}

impl Default for CompilerOptions {
  fn default() -> Self {
    Self {
      check_js: false,
      emit_decorator_metadata: false,
      imports_not_used_as_values: "remove".to_string(),
      inline_source_map: true,
      inline_sources: true,
      jsx: "react".to_string(),
      jsx_factory: "React.createElement".to_string(),
      jsx_fragment_factory: "React.Fragment".to_string(),
      source_map: false,
    }
  }
}

pub(crate) struct EmitOptions {
  pub emit_metadata: bool,
  pub imports_not_used_as_values: ImportsNotUsedAsValues,
  pub inline_source_map: bool,
  pub inline_sources: bool,
  pub repl_imports: bool,
  pub jsx_factory: String,
  pub jsx_fragment_factory: String,
  pub source_map: bool,
  pub transform_jsx: bool,
}

impl Default for EmitOptions {
  fn default() -> Self {
    Self {
      emit_metadata: false,
      imports_not_used_as_values: ImportsNotUsedAsValues::Remove,
      inline_source_map: true,
      inline_sources: true,
      jsx_factory: "React.createElement".into(),
      jsx_fragment_factory: "React.Fragment".into(),
      repl_imports: false,
      source_map: false,
      transform_jsx: true,
    }
  }
}

impl From<CompilerOptions> for EmitOptions {
  fn from(options: CompilerOptions) -> Self {
    let imports_not_used_as_values =
      match options.imports_not_used_as_values.as_str() {
        "preserve" => ImportsNotUsedAsValues::Preserve,
        "error" => ImportsNotUsedAsValues::Error,
        _ => ImportsNotUsedAsValues::Remove,
      };

    Self {
      emit_metadata: options.emit_decorator_metadata,
      imports_not_used_as_values,
      inline_source_map: options.inline_source_map,
      inline_sources: options.inline_sources,
      jsx_factory: options.jsx_factory,
      jsx_fragment_factory: options.jsx_fragment_factory,
      transform_jsx: options.jsx == "react",
      repl_imports: false,
      source_map: options.source_map,
    }
  }
}

impl From<&EmitOptions> for typescript::strip::Config {
  fn from(options: &EmitOptions) -> Self {
    Self {
      import_not_used_as_values: match options.imports_not_used_as_values {
        ImportsNotUsedAsValues::Remove => {
          typescript::strip::ImportsNotUsedAsValues::Remove
        }
        ImportsNotUsedAsValues::Preserve => {
          typescript::strip::ImportsNotUsedAsValues::Preserve
        }
        // `Error` only affects the type-checking stage. Fall back to `Remove`
        // here.
        ImportsNotUsedAsValues::Error => {
          typescript::strip::ImportsNotUsedAsValues::Remove
        }
      },
      use_define_for_class_fields: true,
      no_empty_export: true,
      pragma: Some(options.jsx_factory.clone()),
      pragma_frag: Some(options.jsx_fragment_factory.clone()),
      ts_enum_config: Default::default(),
    }
  }
}

pub(crate) struct SourceMapConfig {
  pub inline_sources: bool,
}

impl SourceMapGenConfig for SourceMapConfig {
  fn file_name_to_source(&self, f: &FileName) -> String {
    f.to_string()
  }

  fn inline_sources_content(&self, f: &FileName) -> bool {
    match f {
      FileName::Real(..) | FileName::Custom(..) => self.inline_sources,
      _ => true,
    }
  }
}

fn fold_program(
  program: Program,
  options: &EmitOptions,
  source_map: Rc<SourceMap>,
  comments: &SingleThreadedComments,
  top_level_mark: Mark,
) -> Program {
  let jsx_pass = chain!(
    resolver_with_mark(top_level_mark),
    react::react(
      source_map.clone(),
      Some(comments),
      react::Options {
        pragma: options.jsx_factory.clone(),
        pragma_frag: options.jsx_fragment_factory.clone(),
        // this will use `Object.assign()` instead of the `_extends` helper
        // when spreading props.
        use_builtins: true,
        ..Default::default()
      },
      top_level_mark,
    ),
  );
  let mut passes = chain!(
    Optional::new(transforms::DownlevelImportsFolder, options.repl_imports),
    Optional::new(transforms::StripExportsFolder, options.repl_imports),
    proposals::decorators::decorators(proposals::decorators::Config {
      legacy: true,
      emit_metadata: options.emit_metadata
    }),
    helpers::inject_helpers(),
    Optional::new(
      // TODO should we use mark or Mark::new here?
      typescript::strip::strip_with_config(options.into(), Mark::new()),
      !options.transform_jsx
    ),
    Optional::new(
      typescript::strip::strip_with_jsx(
        source_map,
        options.into(),
        comments,
        top_level_mark
      ),
      options.transform_jsx
    ),
    Optional::new(jsx_pass, options.transform_jsx),
    fixer(Some(comments)),
    hygiene(),
  );

  helpers::HELPERS.set(&helpers::Helpers::new(false), || {
    program.fold_with(&mut passes)
  })
}

pub(crate) fn transpile_module(
  specifier: &ModuleSpecifier,
  source: &str,
  media_type: MediaType,
  emit_options: &EmitOptions,
  cm: Rc<SourceMap>,
) -> Result<(Rc<deno_ast::swc::common::SourceFile>, Module)> {
  let source = text::strip_bom(source);
  let source_file =
    cm.new_source_file(FileName::Url(specifier.clone()), source.to_string());
  let input = StringInput::from(&*source_file);
  let comments = SingleThreadedComments::default();
  let syntax = get_syntax(media_type);
  let lexer = Lexer::new(
    syntax,
    deno_ast::swc::ast::EsVersion::Es2022,
    input,
    Some(&comments),
  );
  let mut parser = deno_ast::swc::parser::Parser::new_from(lexer);
  let module = parser.parse_module().map_err(|err| {
    let location = cm.lookup_char_pos(err.span().lo);
    Diagnostic {
      specifier: specifier.to_string(),
      span: err.span(),
      display_position: LineAndColumnDisplay {
        line_number: location.line,
        column_number: location.col_display + 1,
      },
      kind: err.into_kind(),
    }
  })?;

  let top_level_mark = Mark::new();
  let program = fold_program(
    Program::Module(module),
    emit_options,
    cm,
    &comments,
    top_level_mark,
  );
  let module = match program {
    Program::Module(module) => module,
    _ => unreachable!(),
  };

  Ok((source_file, module))
}
