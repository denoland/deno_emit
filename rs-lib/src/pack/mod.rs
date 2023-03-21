// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;
use std::ops::Range;
use std::sync::Arc;

use anyhow::bail;
use anyhow::Result;
use deno_ast::apply_text_changes;
use deno_ast::parse_module;
use deno_ast::swc::ast::Id;
use deno_ast::swc::parser::token::Keyword;
use deno_ast::swc::parser::token::Token;
use deno_ast::swc::parser::token::TokenAndSpan;
use deno_ast::swc::parser::token::Word;
use deno_ast::view::Accessibility;
use deno_ast::view::AwaitExpr;
use deno_ast::view::CallExpr;
use deno_ast::view::Callee;
use deno_ast::view::Decl;
use deno_ast::view::DefaultDecl;
use deno_ast::view::ExportDecl;
use deno_ast::view::ExportSpecifier;
use deno_ast::view::Expr;
use deno_ast::view::ExprStmt;
use deno_ast::view::Ident;
use deno_ast::view::ImportSpecifier;
use deno_ast::view::Module;
use deno_ast::view::ModuleDecl;
use deno_ast::view::ModuleExportName;
use deno_ast::view::ModuleItem;
use deno_ast::view::Node;
use deno_ast::view::NodeTrait;
use deno_ast::view::ParamOrTsParamProp;
use deno_ast::view::Pat;
use deno_ast::view::Stmt;
use deno_ast::view::TsModuleDecl;
use deno_ast::view::TsModuleName;
use deno_ast::view::TsNamespaceBody;
use deno_ast::view::TsNamespaceDecl;
use deno_ast::view::TsParamPropParam;
use deno_ast::Diagnostic;
use deno_ast::MediaType;
use deno_ast::ModuleSpecifier;
use deno_ast::ParseParams;
use deno_ast::ParsedSource;
use deno_ast::SourceRange;
use deno_ast::SourceRanged;
use deno_ast::SourceRangedForSpanned;
use deno_ast::SourceTextInfoProvider;
use deno_ast::StartSourcePos;
use deno_ast::TextChange;
use deno_graph::CapturingModuleParser;
use deno_graph::EsmModule;
use deno_graph::JsonModule;
use deno_graph::ModuleGraph;
use deno_graph::ModuleParser;
use deno_graph::WalkOptions;

#[derive(Default)]
struct ModuleDataCollection {
  // todo: pre-allocate when upgrading deno_graph
  module_data: HashMap<ModuleSpecifier, ModuleData>,
}

impl ModuleDataCollection {
  pub fn get(&mut self, specifier: &ModuleSpecifier) -> &mut ModuleData {
    let next_id = self.module_data.len();
    self
      .module_data
      .entry(specifier.clone())
      .or_insert_with(|| ModuleData {
        id: ModuleId(next_id),
        has_tla: false,
        exports: Default::default(),
        re_exports: Default::default(),
        text_changes: Default::default(),
      })
  }
}

#[derive(Debug, Clone, Copy)]
struct ModuleId(usize);

impl ModuleId {
  pub fn to_code_string(&self) -> String {
    format!("pack{}", self.0)
  }
}

struct ExportName {
  // todo: I think these could all be &str
  local_name: String,
  export_name: Option<String>,
}

impl ExportName {
  pub fn export_name(&self) -> &String {
    self.export_name.as_ref().unwrap_or(&self.local_name)
  }
}

enum ReExportName {
  Named(ExportName),
  Namespace(String),
}

struct ReExport {
  name: ReExportName,
  module_id: ModuleId,
}

struct ModuleData {
  id: ModuleId,
  has_tla: bool,
  exports: Vec<ExportName>,
  re_exports: Vec<ReExport>,
  text_changes: Vec<TextChange>,
}

impl ModuleData {
  pub fn add_remove_range(&mut self, range: Range<usize>) {
    self.text_changes.push(TextChange {
      range,
      new_text: String::new(),
    })
  }
}

struct Context<'a> {
  graph: &'a ModuleGraph,
  parser: &'a CapturingModuleParser<'a>,
  module_data: ModuleDataCollection,
}

pub fn pack(
  graph: &ModuleGraph,
  parser: &CapturingModuleParser,
) -> Result<String> {
  // TODO
  // - dynamic imports
  // - `export * from "./module.ts";`
  // - tla
  // - order modules properly (https://v8.dev/features/top-level-await#module-execution-order)
  // - keep remote the same

  let roots = &graph.roots;
  assert_eq!(roots.len(), 1);
  let mut context = Context {
    graph,
    parser,
    module_data: ModuleDataCollection::default(),
  };

  // todo: this is not correct. It should output by walking the graph
  // in the order that the loader does
  let mut ordered_specifiers: Vec<(&ModuleSpecifier, &deno_graph::Module)> =
    Default::default();

  let modules = graph.walk(
    roots,
    WalkOptions {
      check_js: true,
      follow_dynamic: true,
      follow_type_only: true,
    },
  );
  for (specifier, _) in modules {
    let module = graph.get(specifier).unwrap();
    let specifier = module.specifier();
    match module {
      deno_graph::Module::Esm(esm) => {
        ordered_specifiers.push((specifier, module));
        analyze_esm_module(esm, &mut context)?;
      }
      deno_graph::Module::Json(_) => {
        ordered_specifiers.push((specifier, module));
      }
      _ => {
        todo!();
      }
    }
  }

  let mut final_text = String::new();
  for (specifier, module) in &ordered_specifiers {
    if let deno_graph::Module::Esm(_) = module {
      let module_data = context.module_data.get(specifier);
      if module_data.exports.is_empty() {
        continue;
      }
      final_text
        .push_str(&format!("const {} = {{\n", module_data.id.to_code_string()));
      for export in &module_data.exports {
        final_text
          .push_str(&format!("  {}: undefined,\n", export.export_name()));
      }
      for re_export in &module_data.re_exports {
        match &re_export.name {
          ReExportName::Named(name) => {
            final_text
              .push_str(&format!("  {}: undefined,\n", name.export_name()));
          }
          ReExportName::Namespace(_) => {
            todo!();
          }
        }
      }
      final_text.push_str("};\n");
    }
  }

  let root_dir = get_root_dir(ordered_specifiers.iter().map(|(s, _)| *s));
  for (specifier, module) in &ordered_specifiers {
    if let deno_graph::Module::Json(json) = module {
      let module_data = context.module_data.get(specifier);
      if !final_text.is_empty() {
        final_text.push('\n');
      }
      let displayed_specifier = match root_dir {
        Some(prefix) => {
          if specifier.scheme() == "file" {
            let specifier = specifier.as_str();
            specifier.strip_prefix(prefix).unwrap_or(specifier)
          } else {
            specifier.as_str()
          }
        }
        None => specifier.as_str(),
      };
      final_text.push_str(&format!(
        "// {}\nconst {} = {{\n  default: {}\n}};\n",
        displayed_specifier,
        module_data.id.to_code_string(),
        json.source.trim()
      ));
    }
  }

  for (specifier, module) in ordered_specifiers.iter().rev() {
    if let deno_graph::Module::Esm(esm) = module {
      let source = &esm.source;
      let module_data = context.module_data.get(specifier);
      // todo: don't clone
      let module_text =
        apply_text_changes(source, module_data.text_changes.clone());
      let module_text = module_text.trim();
      if !module_text.is_empty()
        || !module_data.exports.is_empty()
        || !module_data.re_exports.is_empty()
      {
        if !final_text.is_empty() {
          final_text.push('\n');
        }
        let displayed_specifier = match root_dir {
          Some(prefix) => {
            if specifier.scheme() == "file" {
              let specifier = specifier.as_str();
              specifier.strip_prefix(prefix).unwrap_or(specifier)
            } else {
              specifier.as_str()
            }
          }
          None => specifier.as_str(),
        };
        final_text.push_str(&format!("// {}\n", displayed_specifier));
        if *specifier == &roots[0] {
          final_text.push_str(&module_text);
          final_text.push_str("\n");
        } else {
          if module_data.has_tla {
            final_text.push_str("await (async () => {\n");
          } else {
            final_text.push_str("(() => {\n");
          }
          if !module_text.is_empty() {
            final_text.push_str(&format!("{}\n", module_text));
          }
          let code_string = module_data.id.to_code_string();
          for export in &module_data.exports {
            final_text.push_str(&format!(
              "Object.defineProperty({}, \"{}\", {{ get: () => {} }});\n",
              code_string,
              export.export_name(),
              export.local_name
            ));
          }
          for re_export in &module_data.re_exports {
            match &re_export.name {
              ReExportName::Named(name) => {
                final_text.push_str(&format!(
                  "Object.defineProperty({}, \"{}\", {{ get: () => {}.{} }});\n",
                  code_string,
                  name.export_name(),
                  re_export.module_id.to_code_string(),
                  name.local_name
                ));
              }
              ReExportName::Namespace(_) => {
                todo!();
              }
            }
          }
          final_text.push_str("})();\n");
        }
      }
    }
  }

  Ok(final_text)
}

fn analyze_esm_module(esm: &EsmModule, context: &mut Context) -> Result<()> {
  let module_specifier = &esm.specifier;
  let parsed_source = context.parser.parse_module(
    module_specifier,
    esm.source.clone(),
    esm.media_type,
  )?;
  let is_root_module = context.graph.roots[0] == *module_specifier;

  parsed_source.with_view(|program| {
    let mut replace_ids = HashMap::new();
    let module = program.module();
    // analyze the top level declarations
    for module_item in &module.body {
      match module_item {
        ModuleItem::Stmt(stmt) => {
          let top_level_await = stmt.to::<AwaitExpr>();
          if top_level_await.is_some() {
            context.module_data.get(module_specifier).has_tla = true;
          }
        }
        ModuleItem::ModuleDecl(decl) => match decl {
          ModuleDecl::Import(import) => {
            if import.type_only() {
              continue;
            }

            let value: &str = import.src.value();
            match context.graph.resolve_dependency(
              value,
              module_specifier,
              false,
            ) {
              Some(dep_specifier) => {
                let dep_module_id = context.module_data.get(&dep_specifier).id;
                for import_specifier in &import.specifiers {
                  match import_specifier {
                    ImportSpecifier::Default(default_specifier) => {
                      replace_ids.insert(
                        default_specifier.local.to_id(),
                        format!("{}.default", dep_module_id.to_code_string(),),
                      );
                    }
                    ImportSpecifier::Namespace(namespace_specifier) => {
                      replace_ids.insert(
                        namespace_specifier.local.to_id(),
                        dep_module_id.to_code_string(),
                      );
                    }
                    ImportSpecifier::Named(named_specifier) => {
                      if !named_specifier.is_type_only() {
                        replace_ids.insert(
                          named_specifier.local.to_id(),
                          format!(
                            "{}.{}",
                            dep_module_id.to_code_string(),
                            named_specifier
                              .imported
                              .map(|i| {
                                match i {
                                  ModuleExportName::Str(_) => todo!(),
                                  ModuleExportName::Ident(ident) => {
                                    ident.text_fast(module)
                                  }
                                }
                              })
                              .unwrap_or_else(|| named_specifier
                                .local
                                .text_fast(module))
                          ),
                        );
                      }
                    }
                  }
                }
              }
              None => {
                todo!();
              }
            }
          }
          ModuleDecl::ExportDefaultDecl(_)
          | ModuleDecl::ExportDefaultExpr(_)
          | ModuleDecl::ExportDecl(_)
          | ModuleDecl::ExportNamed(_)
          | ModuleDecl::ExportAll(_)
          | ModuleDecl::TsImportEquals(_)
          | ModuleDecl::TsExportAssignment(_)
          | ModuleDecl::TsNamespaceExport(_) => {}
        },
      }
    }

    // analyze the exports separately after because they rely on knowing
    // the imports regardless of order
    for module_item in &module.body {
      match module_item {
        ModuleItem::Stmt(stmt) => {}
        ModuleItem::ModuleDecl(decl) => match decl {
          ModuleDecl::Import(_) => {
            continue;
          }
          ModuleDecl::ExportDefaultDecl(decl) => {
            if is_root_module {
              continue;
            }
            let maybe_ident = match &decl.decl {
              DefaultDecl::Class(decl) => decl.ident.as_ref(),
              DefaultDecl::Fn(decl) => decl.ident.as_ref(),
              DefaultDecl::TsInterfaceDecl(_) => continue,
            };
            match maybe_ident {
              Some(ident) => {
                context.module_data.get(module_specifier).exports.push(
                  ExportName {
                    export_name: Some("default".to_string()),
                    local_name: replace_ids
                      .get(&ident.to_id())
                      .map(ToOwned::to_owned)
                      .unwrap_or_else(|| ident.sym().to_string()),
                  },
                );
              }
              None => {
                context.module_data.get(module_specifier).exports.push(
                  ExportName {
                    export_name: Some("default".to_string()),
                    local_name: "__pack_default__".to_string(),
                  },
                );
              }
            }
          }
          ModuleDecl::ExportDefaultExpr(_) => {
            context.module_data.get(module_specifier).exports.push(
              ExportName {
                export_name: Some("default".to_string()),
                local_name: "__pack_default__".to_string(),
              },
            );
          }
          ModuleDecl::ExportDecl(decl) => {
            if is_root_module {
              continue;
            }
            match &decl.decl {
              Decl::Class(decl) => {
                context.module_data.get(module_specifier).exports.push(
                  ExportName {
                    export_name: None,
                    local_name: decl.ident.sym().to_string(),
                  },
                );
              }
              Decl::Fn(decl) => {
                context.module_data.get(module_specifier).exports.push(
                  ExportName {
                    export_name: None,
                    local_name: decl.ident.sym().to_string(),
                  },
                );
              }
              Decl::Var(decl) => {
                for decl in &decl.decls {
                  match &decl.name {
                    Pat::Array(_) => todo!(),
                    Pat::Assign(_) => todo!(),
                    Pat::Ident(ident) => {
                      context.module_data.get(module_specifier).exports.push(
                        ExportName {
                          export_name: None,
                          local_name: ident.id.sym().to_string(),
                        },
                      );
                    }
                    Pat::Rest(_) => todo!(),
                    Pat::Object(_) => todo!(),
                    Pat::Invalid(_) => todo!(),
                    Pat::Expr(_) => todo!(),
                  }
                }
              }
              Decl::TsEnum(decl) => {
                context.module_data.get(module_specifier).exports.push(
                  ExportName {
                    export_name: None,
                    local_name: decl.id.sym().to_string(),
                  },
                );
              }
              Decl::TsModule(decl) => {
                if let TsModuleName::Ident(id) = &decl.id {
                  // the namespace will be exported as the first id
                  context.module_data.get(module_specifier).exports.push(
                    ExportName {
                      export_name: None,
                      local_name: id.sym().to_string(),
                    },
                  );
                }
              }
              Decl::TsInterface(_) | Decl::TsTypeAlias(_) => {}
            }
          }
          ModuleDecl::ExportNamed(decl) => {
            if let Some(src) = &decl.src {
              match context.graph.resolve_dependency(
                src.value(),
                module_specifier,
                false,
              ) {
                Some(dep) => {
                  let dep_id = context.module_data.get(&dep).id;
                  let module_data = context.module_data.get(module_specifier);
                  for export_specifier in &decl.specifiers {
                    match export_specifier {
                      ExportSpecifier::Default(_) => {
                        todo!(); // what even is this? Maybe some babel thing or I'm not thinking atm
                      }
                      ExportSpecifier::Named(named) => {
                        module_data.re_exports.push(ReExport {
                          name: ReExportName::Named(ExportName {
                            export_name: named.exported.as_ref().map(|name| {
                              match name {
                                ModuleExportName::Ident(ident) => {
                                  ident.sym().to_string()
                                }
                                ModuleExportName::Str(_) => todo!(),
                              }
                            }),
                            local_name: match named.orig {
                              ModuleExportName::Ident(ident) => {
                                ident.sym().to_string()
                              }
                              ModuleExportName::Str(_) => todo!(),
                            },
                          }),
                          module_id: dep_id,
                        })
                      }
                      ExportSpecifier::Namespace(namespace) => {
                        module_data.re_exports.push(ReExport {
                          name: ReExportName::Namespace(match namespace.name {
                            ModuleExportName::Ident(ident) => {
                              ident.sym().to_string()
                            }
                            ModuleExportName::Str(_) => todo!(),
                          }),
                          module_id: dep_id,
                        })
                      }
                    }
                  }
                }
                None => {
                  todo!();
                }
              }
            } else {
              // no specifier
              let module_data = context.module_data.get(module_specifier);
              for export_specifier in &decl.specifiers {
                match export_specifier {
                  ExportSpecifier::Named(named) => {
                    let (local_name, local_name_as_export) = {
                      match named.orig {
                        ModuleExportName::Ident(ident) => {
                          let ident_text = ident.sym().to_string();
                          let local_name = replace_ids
                            .get(&ident.to_id())
                            .map(ToOwned::to_owned)
                            .unwrap_or_else(|| ident_text.clone());
                          let local_name_as_export = if ident_text != local_name
                          {
                            Some(ident_text)
                          } else {
                            None
                          };
                          (local_name, local_name_as_export)
                        }
                        ModuleExportName::Str(_) => todo!(),
                      }
                    };
                    module_data.exports.push(ExportName {
                      export_name: named
                        .exported
                        .as_ref()
                        .map(|name| match name {
                          ModuleExportName::Ident(ident) => {
                            ident.sym().to_string()
                          }
                          ModuleExportName::Str(_) => todo!(),
                        })
                        .or(local_name_as_export),
                      local_name,
                    });
                  }
                  ExportSpecifier::Namespace(_)
                  | ExportSpecifier::Default(_) => unreachable!(),
                }
              }
            }
          }
          ModuleDecl::ExportAll(export_all) => {}
          ModuleDecl::TsImportEquals(_)
          | ModuleDecl::TsExportAssignment(_)
          | ModuleDecl::TsNamespaceExport(_) => {}
        },
      }
    }

    let module_data = context.module_data.get(module_specifier);
    // replace all the identifiers
    let mut collector = TextChangeCollector {
      module_data: module_data,
      replace_ids: &replace_ids,
      module,
      file_start: module.text_info().range().start,
      is_root_module,
    };
    collector.visit_children(module.into());
  });
  Ok(())
}

struct TextChangeCollector<'a> {
  module_data: &'a mut ModuleData,
  replace_ids: &'a HashMap<Id, String>,
  module: &'a Module<'a>,
  file_start: StartSourcePos,
  is_root_module: bool,
}

impl<'a> TextChangeCollector<'a> {
  fn remove_range(&mut self, source_range: SourceRange) {
    self
      .module_data
      .add_remove_range(source_range.as_byte_range(self.file_start));
  }

  fn remove_range_with_previous_whitespace(
    &mut self,
    source_range: SourceRange,
  ) {
    let byte_range = source_range.as_byte_range(self.file_start);
    let file_text = self.module.text_info.unwrap().text_str();
    let file_start = &file_text[..byte_range.start];
    let file_start_trimmed = file_start.trim_end();
    self
      .module_data
      .add_remove_range(file_start_trimmed.len()..byte_range.end);
  }

  // todo: does it make sense to have both?
  fn remove_range_with_next_whitespace(&mut self, source_range: SourceRange) {
    let byte_range = source_range.as_byte_range(self.file_start);
    let file_text = self.module.text_info.unwrap().text_str();
    let file_end = &file_text[byte_range.end..];
    let file_end_trimmed = file_end.trim_start();
    self.module_data.add_remove_range(
      byte_range.start
        ..byte_range.end + (file_end.len() - file_end_trimmed.len()),
    );
  }

  fn remove_token(&mut self, token: &TokenAndSpan) {
    self.remove_range_with_next_whitespace(token.range())
  }

  fn remove_first_token(&mut self, range: SourceRange, token: &str) {
    self.remove_token(
      range
        .tokens_fast(self.module)
        .iter()
        .find(|t| t.text_fast(self.module) == token)
        .unwrap(),
    );
  }

  pub fn visit_children(&mut self, node: Node) {
    for child in node.children() {
      self.visit(child);
    }
  }

  pub fn visit(&mut self, node: Node) {
    match node {
      Node::Ident(ident) => {
        let id = ident.to_id();
        if let Some(text) = self.replace_ids.get(&id) {
          self.module_data.text_changes.push(TextChange {
            range: ident.range().as_byte_range(self.file_start),
            new_text: text.clone(),
          })
        }
      }
      Node::ExportDefaultExpr(expr) => {
        let default_keyword = expr
          .tokens_fast(self.module)
          .iter()
          .find(|t| t.token == Token::Word(Word::Keyword(Keyword::Default_)))
          .unwrap();
        let start = expr.start().as_byte_index(self.file_start);
        self.module_data.text_changes.push(TextChange {
          range: start
            ..default_keyword
              .next_token_fast(self.module)
              .unwrap()
              .start()
              .as_byte_index(self.file_start),
          new_text: "const __pack_default__ = ".to_string(),
        });
      }
      Node::ExportDefaultDecl(decl) => {
        if let DefaultDecl::TsInterfaceDecl(_) = &decl.decl {
          // remove it
          let range = decl.range().as_byte_range(self.file_start);
          self.module_data.add_remove_range(range);
        } else {
          if !self.is_root_module {
            let export_keyword = decl
              .tokens_fast(self.module)
              .iter()
              .find(|t| t.token == Token::Word(Word::Keyword(Keyword::Export)))
              .unwrap();
            let default_keyword =
              export_keyword.range().next_token_fast(self.module).unwrap();
            assert_eq!(
              default_keyword.token,
              Token::Word(Word::Keyword(Keyword::Default_))
            );
            // remove the "export default" keywords
            self.module_data.add_remove_range(
              export_keyword.start().as_byte_index(self.file_start)
                ..default_keyword
                  .next_token_fast(self.module)
                  .unwrap()
                  .start()
                  .as_byte_index(self.file_start),
            );

            let maybe_ident = match &decl.decl {
              DefaultDecl::Class(decl) => decl.ident.as_ref(),
              DefaultDecl::Fn(decl) => decl.ident.as_ref(),
              DefaultDecl::TsInterfaceDecl(_) => {
                unreachable!();
              }
            };
            if maybe_ident.is_none() {
              let start = decl.start().as_byte_index(self.file_start);
              self.module_data.text_changes.push(TextChange {
                range: start..start,
                new_text: "const __pack_default__ = ".to_string(),
              })
            }
          }

          self.visit(decl.decl.into());
        }
      }
      Node::ExportDecl(decl) => {
        match &decl.decl {
          Decl::TsInterface(_) | Decl::TsTypeAlias(_) => {
            self.remove_range(decl.range());
          }
          Decl::Class(_)
          | Decl::Fn(_)
          | Decl::Var(_)
          | Decl::TsEnum(_)
          | Decl::TsModule(_) => {
            if !self.is_root_module {
              let export_keyword = decl
                .tokens_fast(self.module)
                .iter()
                .find(|t| {
                  t.token == Token::Word(Word::Keyword(Keyword::Export))
                })
                .unwrap();
              // remove the "export" keyword
              self.module_data.add_remove_range(
                export_keyword.start().as_byte_index(self.file_start)
                  ..export_keyword
                    .next_token_fast(self.module)
                    .unwrap()
                    .start()
                    .as_byte_index(self.file_start),
              );
            }

            for child in node.children() {
              self.visit(child.into());
            }
          }
        }
      }
      Node::ImportDecl(_) | Node::NamedExport(_) => {
        self.remove_range(node.range());
      }
      Node::Class(class) => {
        let implements_range = if class.implements.is_empty() {
          None
        } else {
          // remove the implements clause
          let implements_token =
            class.implements[0].previous_token_fast(self.module);
          assert_eq!(implements_token.text_fast(self.module), "implements");
          let last_token = class.implements.last().unwrap();
          let range = SourceRange::new(
            implements_token.start(),
            last_token.next_token_fast(self.module).start(),
          );
          self.remove_range(range);
          Some(range)
        };

        for child in class.children() {
          if let Some(implements_range) = &implements_range {
            if implements_range.contains(&child.range()) {
              // skip over anything in the implements clause
              continue;
            }
          }
          self.visit(child);
        }
      }
      Node::ClassProp(prop) => {
        if prop.declare() {
          self.remove_range_with_previous_whitespace(prop.range());
        } else {
          if let Some(accessibility) = prop.accessibility() {
            let keyword = accessibility_text(accessibility);
            self.remove_first_token(prop.range(), keyword);
          }
          if prop.readonly() {
            self.remove_first_token(prop.range(), "readonly");
          }
          if prop.is_override() {
            self.remove_first_token(prop.range(), "override");
          }
          if prop.is_abstract() {
            self.remove_first_token(prop.range(), "abstract");
          }
          self.visit_children(prop.into());
        }
      }
      Node::Constructor(ctor) => {
        self.visit_children(ctor.into());

        // emit the parameter properties
        for param in &ctor.params {
          if let ParamOrTsParamProp::TsParamProp(param) = param {
            if let Some(body) = &ctor.body {
              let insert_pos = if let Some(Stmt::Expr(ExprStmt {
                expr:
                  Expr::Call(CallExpr {
                    callee: Callee::Super(_),
                    ..
                  }),
                ..
              })) = body.stmts.get(0)
              {
                // put it after the super call
                body.stmts[0].end()
              } else {
                body.start() + 1 // insert after the opening brace
              }
              .as_byte_index(self.file_start);
              self.module_data.text_changes.push(TextChange {
                range: insert_pos..insert_pos,
                new_text: format!(
                  "\nthis.{0} = {0};",
                  match param.param {
                    TsParamPropParam::Assign(assign) => {
                      match &assign.left {
                        Pat::Ident(ident) => ident.id.sym(),
                        pat => pat.text_fast(self.module),
                      }
                    }
                    TsParamPropParam::Ident(ident) => {
                      let text: &str = ident.id.sym();
                      text
                    }
                  }
                ),
              });
            }
          }
        }
      }
      Node::ArrayLit(_)
      | Node::ArrayPat(_)
      | Node::ArrowExpr(_)
      | Node::AssignExpr(_)
      | Node::AssignPat(_)
      | Node::AssignPatProp(_)
      | Node::AssignProp(_)
      | Node::AutoAccessor(_)
      | Node::AwaitExpr(_)
      | Node::BigInt(_)
      | Node::BinExpr(_)
      | Node::BindingIdent(_)
      | Node::BlockStmt(_)
      | Node::Bool(_)
      | Node::BreakStmt(_)
      | Node::CallExpr(_)
      | Node::CatchClause(_)
      | Node::ClassDecl(_)
      | Node::ClassExpr(_)
      | Node::ClassMethod(_)
      | Node::ComputedPropName(_)
      | Node::CondExpr(_)
      | Node::ContinueStmt(_)
      | Node::DebuggerStmt(_)
      | Node::Decorator(_)
      | Node::DoWhileStmt(_)
      | Node::EmptyStmt(_)
      | Node::ExportAll(_)
      | Node::ExportDefaultSpecifier(_)
      | Node::ExportNamedSpecifier(_)
      | Node::ExportNamespaceSpecifier(_)
      | Node::ExprOrSpread(_)
      | Node::ExprStmt(_)
      | Node::FnDecl(_)
      | Node::FnExpr(_)
      | Node::ForInStmt(_)
      | Node::ForOfStmt(_)
      | Node::ForStmt(_)
      | Node::Function(_)
      | Node::GetterProp(_)
      | Node::IfStmt(_)
      | Node::Import(_)
      | Node::ImportDefaultSpecifier(_)
      | Node::ImportNamedSpecifier(_)
      | Node::ImportStarAsSpecifier(_)
      | Node::Invalid(_)
      | Node::JSXAttr(_)
      | Node::JSXClosingElement(_)
      | Node::JSXClosingFragment(_)
      | Node::JSXElement(_)
      | Node::JSXEmptyExpr(_)
      | Node::JSXExprContainer(_)
      | Node::JSXFragment(_)
      | Node::JSXMemberExpr(_)
      | Node::JSXNamespacedName(_)
      | Node::JSXOpeningElement(_)
      | Node::JSXOpeningFragment(_)
      | Node::JSXSpreadChild(_)
      | Node::JSXText(_)
      | Node::KeyValuePatProp(_)
      | Node::KeyValueProp(_)
      | Node::LabeledStmt(_)
      | Node::MemberExpr(_)
      | Node::MetaPropExpr(_)
      | Node::MethodProp(_)
      | Node::Module(_)
      | Node::NewExpr(_)
      | Node::Null(_)
      | Node::Number(_)
      | Node::ObjectLit(_)
      | Node::ObjectPat(_)
      | Node::OptCall(_)
      | Node::OptChainExpr(_)
      | Node::Param(_)
      | Node::ParenExpr(_)
      | Node::PrivateMethod(_)
      | Node::PrivateName(_)
      | Node::PrivateProp(_)
      | Node::Regex(_)
      | Node::RestPat(_)
      | Node::ReturnStmt(_)
      | Node::Script(_)
      | Node::SeqExpr(_)
      | Node::SetterProp(_)
      | Node::SpreadElement(_)
      | Node::StaticBlock(_)
      | Node::Str(_)
      | Node::Super(_)
      | Node::SuperPropExpr(_)
      | Node::SwitchCase(_)
      | Node::SwitchStmt(_)
      | Node::TaggedTpl(_)
      | Node::ThisExpr(_)
      | Node::ThrowStmt(_)
      | Node::Tpl(_)
      | Node::TplElement(_)
      | Node::TryStmt(_)
      | Node::UnaryExpr(_)
      | Node::UpdateExpr(_)
      | Node::VarDecl(_)
      | Node::VarDeclarator(_)
      | Node::WhileStmt(_)
      | Node::WithStmt(_)
      | Node::YieldExpr(_) => {
        self.visit_children(node);
      }

      Node::TsEnumDecl(_) => {
        // todo...
      }
      Node::TsAsExpr(expr) => {
        self.remove_range(SourceRange::new(expr.expr.end(), expr.end()));
        // keep going into the descendant expressions
        self.visit(expr.expr.into());
      }
      Node::TsSatisfiesExpr(expr) => {
        self.remove_range(SourceRange::new(expr.expr.end(), expr.end()));
        // keep going into the descendant expressions
        self.visit(expr.expr.into());
      }
      Node::TsParamProp(prop) => {
        if let Some(accessibility) = prop.accessibility() {
          let keyword = accessibility_text(accessibility);
          self.remove_first_token(prop.range(), keyword);
        }
        if prop.readonly() {
          self.remove_first_token(prop.range(), "readonly");
        }
        if prop.is_override() {
          self.remove_first_token(prop.range(), "override");
        }
        self.visit_children(prop.into());
      }
      Node::TsNamespaceDecl(_) => {
        // todo
      }
      Node::TsArrayType(_)
      | Node::TsCallSignatureDecl(_)
      | Node::TsConditionalType(_)
      | Node::TsConstAssertion(_)
      | Node::TsConstructSignatureDecl(_)
      | Node::TsConstructorType(_)
      | Node::TsEnumMember(_)
      | Node::TsExportAssignment(_)
      | Node::TsExprWithTypeArgs(_)
      | Node::TsExternalModuleRef(_)
      | Node::TsFnType(_)
      | Node::TsGetterSignature(_)
      | Node::TsImportEqualsDecl(_)
      | Node::TsImportType(_)
      | Node::TsIndexSignature(_)
      | Node::TsIndexedAccessType(_)
      | Node::TsInferType(_)
      | Node::TsInstantiation(_)
      | Node::TsInterfaceBody(_)
      | Node::TsIntersectionType(_)
      | Node::TsKeywordType(_)
      | Node::TsLitType(_)
      | Node::TsMappedType(_)
      | Node::TsMethodSignature(_)
      | Node::TsModuleBlock(_)
      | Node::TsModuleDecl(_)
      | Node::TsNamespaceExportDecl(_)
      | Node::TsNonNullExpr(_)
      | Node::TsOptionalType(_)
      | Node::TsParenthesizedType(_)
      | Node::TsPropertySignature(_)
      | Node::TsQualifiedName(_)
      | Node::TsRestType(_)
      | Node::TsSetterSignature(_)
      | Node::TsThisType(_)
      | Node::TsTplLitType(_)
      | Node::TsTupleElement(_)
      | Node::TsTupleType(_)
      | Node::TsTypeAnn(_)
      | Node::TsTypeAssertion(_)
      | Node::TsTypeLit(_)
      | Node::TsTypeOperator(_)
      | Node::TsTypeParam(_)
      | Node::TsTypeParamDecl(_)
      | Node::TsTypeParamInstantiation(_)
      | Node::TsTypePredicate(_)
      | Node::TsTypeQuery(_)
      | Node::TsTypeRef(_)
      | Node::TsTypeAliasDecl(_)
      | Node::TsInterfaceDecl(_)
      | Node::TsUnionType(_) => {
        self
          .module_data
          .add_remove_range(node.range().as_byte_range(self.file_start));
      }
    }
  }
}

fn accessibility_text(accessibility: Accessibility) -> &'static str {
  match accessibility {
    Accessibility::Private => "private",
    Accessibility::Protected => "protected",
    Accessibility::Public => "public",
  }
}

fn get_root_dir<'a>(
  specifiers: impl Iterator<Item = &'a ModuleSpecifier>,
) -> Option<&'a str> {
  fn get_folder(specifier: &ModuleSpecifier) -> &str {
    let specifier = specifier.as_str();
    let r_index = specifier.rfind('/').unwrap();
    &specifier[..r_index]
  }

  let mut root: Option<&str> = None;
  for specifier in specifiers.filter(|s| s.scheme() == "file") {
    let folder = get_folder(specifier);
    if root.is_none() || root.as_ref().unwrap().starts_with(folder) {
      root = Some(folder);
    }
  }
  if root == Some("file://") {
    Some("file:///")
  } else {
    root
  }
}
