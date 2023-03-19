// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;
use std::sync::Arc;

use anyhow::bail;
use anyhow::Result;
use deno_ast::SourceRangedForSpanned;
use deno_ast::apply_text_changes;
use deno_ast::parse_module;
use deno_ast::view::DefaultDecl;
use deno_ast::swc::ast::Id;
use deno_ast::swc::parser::token::Keyword;
use deno_ast::swc::parser::token::Token;
use deno_ast::swc::parser::token::Word;
use deno_ast::view::AwaitExpr;
use deno_ast::view::ImportSpecifier;
use deno_ast::view::Module;
use deno_ast::view::ModuleDecl;
use deno_ast::view::ModuleExportName;
use deno_ast::view::ModuleItem;
use deno_ast::view::Node;
use deno_ast::view::NodeTrait;
use deno_ast::Diagnostic;
use deno_ast::MediaType;
use deno_ast::ModuleSpecifier;
use deno_ast::ParseParams;
use deno_ast::ParsedSource;
use deno_ast::SourceRanged;
use deno_ast::SourceTextInfo;
use deno_ast::SourceTextInfoProvider;
use deno_ast::TextChange;
use deno_graph::CapturingModuleParser;
use deno_graph::ModuleGraph;
use deno_graph::ModuleParser;
use deno_graph::WalkOptions;

#[derive(Default)]
struct ModuleDataCollection {
  // todo: pre-allocate when upgrading deno_graph
  module_data: HashMap<ModuleSpecifier, ModuleData>,
}

impl ModuleDataCollection {
  pub fn get_mut(&mut self, specifier: &ModuleSpecifier) -> &mut ModuleData {
    let next_id = self.module_data.len();
    self
      .module_data
      .entry(specifier.clone())
      .or_insert_with(|| ModuleData {
        id: ModuleId(next_id),
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

struct ModuleData {
  id: ModuleId,
  text_changes: Vec<TextChange>,
}

struct IdReplace {
  module_id: usize,
}

pub fn pack(
  graph: &ModuleGraph,
  parser: &CapturingModuleParser,
) -> Result<String> {
  let roots = &graph.roots;
  assert_eq!(roots.len(), 1);
  let mut dynamic_modules: HashSet<ModuleSpecifier> = Default::default();
  let mut module_data = ModuleDataCollection::default();
  let mut seen: HashSet<&ModuleSpecifier> = Default::default();
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
    if !seen.insert(specifier) {
      continue;
    }

    if let Some(esm) = module.esm() {
      ordered_specifiers.push((specifier, module));
      let parsed_source =
        parser.parse_module(specifier, esm.source.clone(), esm.media_type)?;

      parsed_source.with_view(|program| {
        let mut replace_ids = HashMap::new();
        let module = program.module();
        for module_item in &module.body {
          match module_item {
            ModuleItem::Stmt(stmt) => {
              let top_level_await = stmt.to::<AwaitExpr>();
              if top_level_await.is_some() {
                todo!();
              }
            }
            ModuleItem::ModuleDecl(decl) => match decl {
              ModuleDecl::Import(import) => {
                if import.type_only() {
                  todo!();
                }

                let value: &str = import.src.value();
                match graph.resolve_dependency(value, specifier, false) {
                  Some(dep_specifier) => {
                    let dep_module_id = module_data.get_mut(&dep_specifier).id;
                    let range = import.range();
                    if import.asserts.is_some() {
                      todo!();
                    }
                    for import_specifier in &import.specifiers {
                      match import_specifier {
                        ImportSpecifier::Default(default_specifier) => {
                          replace_ids.insert(
                            default_specifier.local.to_id(),
                            format!(
                              "{}.__pack_default__",
                              dep_module_id.to_code_string(),
                            ),
                          );
                        }
                        ImportSpecifier::Namespace(namespace_specifier) => {
                          replace_ids.insert(
                            namespace_specifier.local.to_id(),
                            dep_module_id.to_code_string(),
                          );
                        }
                        ImportSpecifier::Named(named_specifier) => {
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

                    // remove the import statement
                    module_data.get_mut(&specifier).text_changes.push(
                      TextChange {
                        range: range.as_byte_range(
                          parsed_source.text_info().range().start,
                        ),
                        new_text: String::new(),
                      },
                    );
                  }
                  None => {
                    todo!();
                  }
                }
              }
              ModuleDecl::ExportDefaultDecl(decl) => {
                let export_keyword = decl.tokens_fast(module).iter().find(|t| t.token == Token::Word(Word::Keyword(Keyword::Export))).unwrap();
                let default_keyword = export_keyword.range().next_token_fast(module).unwrap();
                assert_eq!(default_keyword.token, Token::Word(Word::Keyword(Keyword::Default_)));
                let file_start = parsed_source.text_info().range().start;
                // remove the "export default" keywords
                let module_data = module_data.get_mut(&specifier);
                module_data.text_changes.push(
                  TextChange {
                    range: export_keyword.start().as_byte_index(file_start)..default_keyword.end().as_byte_index(file_start),
                    new_text: String::new(),
                  },
                );

                // change the default export to have a different name for the export
                // since we can't use the word "default"
                if let DefaultDecl::TsInterfaceDecl(decl) = &decl.decl {
                    let end = decl.end().as_byte_index(file_start);
                    module_data.text_changes.push(
                      TextChange {
                        range: end..end,
                        new_text: format!("\nexport interface __pack_default__ extends {} {{}}", decl.id.sym()),
                      }
                    )
                } else {
                  let maybe_ident = match &decl.decl {
                    DefaultDecl::Class(decl) => {
                      decl.ident.as_ref()
                    }
                    DefaultDecl::Fn(decl) => {
                      decl.ident.as_ref()
                    }
                    DefaultDecl::TsInterfaceDecl(_) => {
                      unreachable!();
                    }
                  };
                  match maybe_ident {
                    Some(ident) => {
                      let end = decl.end().as_byte_index(file_start);
                      module_data.text_changes.push(
                        TextChange {
                          range: end..end,
                          new_text: format!("\nexport const __pack_default__ = {};", ident.sym()),
                        }
                      )
                    },
                    None => {
                      let start = decl.start().as_byte_index(file_start);
                      module_data.text_changes.push(
                        TextChange {
                          range: start..start,
                          new_text: "export const __pack_default__ = ".to_string(),
                        }
                      )
                    }
                  }
                }
              }
              _ => {}
            },
          }
        }

        fn for_each_descendant(
          node: Node,
          module_data: &mut ModuleData,
          replace_ids: &HashMap<Id, String>,
          module: &Module,
        ) {
          for child in node.children() {
            match child {
              Node::Ident(ident) => {
                let id = ident.to_id();
                if let Some(text) = replace_ids.get(&id) {
                  module_data.text_changes.push(TextChange {
                    range: ident
                      .range()
                      .as_byte_range(module.text_info().range().start),
                    new_text: text.clone(),
                  })
                }
              }
              _ => {
                for_each_descendant(child, module_data, replace_ids, module);
              }
            }
          }
        }

        let module_data = module_data.get_mut(specifier);
        for module_item in &module.body {
          match module_item {
            ModuleItem::Stmt(stmt) => {
              for_each_descendant(
                stmt.into(),
                module_data,
                &replace_ids,
                module,
              );
            }
            _ => {}
          }
        }
      });
    }
  }

  let mut final_text = String::new();
  for (specifier, module) in ordered_specifiers.iter().rev() {
    let module = module.esm().unwrap();
    let module_data = module_data.get_mut(specifier);
    // todo: don't clone
    let module_text =
      apply_text_changes(&module.source, module_data.text_changes.clone());
    if !final_text.is_empty() {
      final_text.push('\n');
    }
    final_text.push_str(&format!("// {}\n", specifier));
    if *specifier == &roots[0] {
      final_text.push_str(&module_text.trim());
      final_text.push_str("\n");
    } else {
      final_text.push_str(&format!(
        "namespace {} {{\n{}\n}}\n",
        module_data.id.to_code_string(),
        module_text.trim()
      ));
    }
  }

  Ok(final_text)
}
