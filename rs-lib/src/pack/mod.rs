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
use deno_ast::swc::parser::token::Word;
use deno_ast::view::AwaitExpr;
use deno_ast::view::Decl;
use deno_ast::view::DefaultDecl;
use deno_ast::view::ExportDecl;
use deno_ast::view::Ident;
use deno_ast::view::ImportSpecifier;
use deno_ast::view::Module;
use deno_ast::view::ModuleDecl;
use deno_ast::view::ModuleExportName;
use deno_ast::view::ModuleItem;
use deno_ast::view::Node;
use deno_ast::view::NodeTrait;
use deno_ast::view::Pat;
use deno_ast::view::TsModuleDecl;
use deno_ast::view::TsModuleName;
use deno_ast::view::TsNamespaceBody;
use deno_ast::view::TsNamespaceDecl;
use deno_ast::Diagnostic;
use deno_ast::MediaType;
use deno_ast::ModuleSpecifier;
use deno_ast::ParseParams;
use deno_ast::ParsedSource;
use deno_ast::SourceRanged;
use deno_ast::SourceRangedForSpanned;
use deno_ast::SourceTextInfoProvider;
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

struct ModuleData {
  id: ModuleId,
  has_tla: bool,
  exports: Vec<ExportName>,
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

struct IdReplace {
  module_id: usize,
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
  // - `export { something, other as otherThing };`
  // - `export { exp1, type exp2 } from "./module.ts"`
  // - `export type { exp2 } from "./module.ts"`
  // - `export * from "./module.ts";`
  // - `export type * from "./module.ts";`
  // - `export default 5`
  // - tla
  // - order modules properly (https://v8.dev/features/top-level-await#module-execution-order)

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
      deno_graph::Module::Json(json) => {
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
        final_text.push_str(&format!(
          "  {}: undefined,\n",
          export.export_name.as_ref().unwrap_or(&export.local_name)
        ));
      }
      final_text.push_str("};\n");
    }
  }

  for (specifier, module) in &ordered_specifiers {
    if let deno_graph::Module::Json(json) = module {
      let module_data = context.module_data.get(specifier);
      if !final_text.is_empty() {
        final_text.push('\n');
      }
      final_text.push_str(&format!(
        "// {}\nconst {} = {{\n  default: {}\n}};\n",
        specifier,
        module_data.id.to_code_string(),
        json.source
      ));
    }
  }

  for (specifier, module) in ordered_specifiers.iter().rev() {
    if let deno_graph::Module::Esm(esm) = module {
      if !final_text.is_empty() {
        final_text.push('\n');
      }
      final_text.push_str(&format!("// {}\n", specifier));

      let source = &esm.source;
      let module_data = context.module_data.get(specifier);
      // todo: don't clone
      let module_text =
        apply_text_changes(source, module_data.text_changes.clone());
      if *specifier == &roots[0] {
        final_text.push_str(&module_text.trim());
        final_text.push_str("\n");
      } else {
        if module_data.has_tla {
          final_text.push_str("await (async () => {");
        } else {
          final_text.push_str("(() => {");
        }
        final_text.push_str(&format!("\n{}\n", module_text.trim()));
        if !module_data.exports.is_empty() {
          let code_string = module_data.id.to_code_string();
          for export in &module_data.exports {
            final_text.push_str(&format!(
              "{}.{} = {};\n",
              code_string,
              export.export_name.as_ref().unwrap_or(&export.local_name),
              export.local_name
            ));
          }
        }
        final_text.push_str("})();\n");
      }
    }
  }

  Ok(final_text)
}

fn analyze_esm_module(esm: &EsmModule, context: &mut Context) -> Result<()> {
  let specifier = &esm.specifier;
  let parsed_source = context.parser.parse_module(
    specifier,
    esm.source.clone(),
    esm.media_type,
  )?;
  let is_root_module = context.graph.roots[0] == *specifier;

  parsed_source.with_view(|program| {
    let mut replace_ids = HashMap::new();
    let module = program.module();
    // analyze the top level declarations
    for module_item in &module.body {
      match module_item {
        ModuleItem::Stmt(stmt) => {
          let top_level_await = stmt.to::<AwaitExpr>();
          if top_level_await.is_some() {
            context.module_data.get(specifier).has_tla = true;
          }
        }
        ModuleItem::ModuleDecl(decl) => match decl {
          ModuleDecl::Import(import) => {
            if import.type_only() {
              continue;
            }

            let value: &str = import.src.value();
            match context.graph.resolve_dependency(value, specifier, false) {
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
                context.module_data.get(specifier).exports.push(ExportName {
                  export_name: Some("default".to_string()),
                  local_name: ident.sym().to_string(),
                });
              }
              None => {
                context.module_data.get(specifier).exports.push(ExportName {
                  export_name: Some("default".to_string()),
                  local_name: "__pack_default__".to_string(),
                });
              }
            }
          }
          ModuleDecl::ExportDecl(decl) => {
            if is_root_module {
              continue;
            }
            match &decl.decl {
              Decl::Class(decl) => {
                context.module_data.get(specifier).exports.push(ExportName {
                  export_name: None,
                  local_name: decl.ident.sym().to_string(),
                });
              }
              Decl::Fn(decl) => {
                context.module_data.get(specifier).exports.push(ExportName {
                  export_name: None,
                  local_name: decl.ident.sym().to_string(),
                });
              }
              Decl::Var(decl) => {
                for decl in &decl.decls {
                  match &decl.name {
                    Pat::Array(_) => todo!(),
                    Pat::Assign(_) => todo!(),
                    Pat::Ident(ident) => {
                      context.module_data.get(specifier).exports.push(
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
                context.module_data.get(specifier).exports.push(ExportName {
                  export_name: None,
                  local_name: decl.id.sym().to_string(),
                });
              }
              Decl::TsModule(decl) => {
                // fn get_ts_module_name(
                //   id: &Ident,
                //   body: &TsNamespaceBody,
                // ) -> String {
                //   let mut text = id.sym().to_string();
                //   if let Some(name) = get_ts_namespace_body_name(&body) {
                //     text.push_str(&name)
                //   }
                //   text
                // }

                // fn get_ts_namespace_body_name(
                //   body: &TsNamespaceBody,
                // ) -> Option<String> {
                //   if let TsNamespaceBody::TsNamespaceDecl(decl) = body {
                //     Some(format!(".{}", get_ts_module_name(&decl.id, &decl.body)))
                //   } else {
                //     None
                //   }
                // }

                if let TsModuleName::Ident(id) = &decl.id {
                  // let name = match &decl.body {
                  //   Some(body) => get_ts_module_name(id, body),
                  //   None => id.sym().to_string(),
                  // };

                  // the namespace will be exported as the first id
                  context.module_data.get(specifier).exports.push(ExportName {
                    export_name: None,
                    local_name: id.sym().to_string(),
                  });
                }
              }
              Decl::TsInterface(_) | Decl::TsTypeAlias(_) => {}
            }
          }
          ModuleDecl::ExportNamed(decl) => {
            //decl.inner
            todo!(); // todo: left off here
          }
          ModuleDecl::ExportDefaultExpr(default_expr) => {}
          ModuleDecl::ExportAll(export_all) => {}
          ModuleDecl::TsImportEquals(_)
          | ModuleDecl::TsExportAssignment(_)
          | ModuleDecl::TsNamespaceExport(_) => {}
        },
      }
    }

    fn for_each_descendant(
      // todo: create a context object here
      node: Node,
      module_data: &mut ModuleData,
      replace_ids: &HashMap<Id, String>,
      module: &Module,
      is_root_module: bool,
    ) {
      let file_start = module.text_info().range().start;
      for child in node.children() {
        match child {
          Node::Ident(ident) => {
            let id = ident.to_id();
            if let Some(text) = replace_ids.get(&id) {
              module_data.text_changes.push(TextChange {
                range: ident.range().as_byte_range(file_start),
                new_text: text.clone(),
              })
            }
          }
          Node::ExportDefaultDecl(decl) => {
            if let DefaultDecl::TsInterfaceDecl(decl) = &decl.decl {
              // remove it
              let range = decl.range().as_byte_range(file_start);
              module_data.add_remove_range(range);
            } else {
              if !is_root_module {
                let export_keyword = decl
                  .tokens_fast(module)
                  .iter()
                  .find(|t| {
                    t.token == Token::Word(Word::Keyword(Keyword::Export))
                  })
                  .unwrap();
                let default_keyword =
                  export_keyword.range().next_token_fast(module).unwrap();
                assert_eq!(
                  default_keyword.token,
                  Token::Word(Word::Keyword(Keyword::Default_))
                );
                // remove the "export default" keywords
                module_data.add_remove_range(
                  export_keyword.start().as_byte_index(file_start)
                    ..default_keyword
                      .next_token_fast(module)
                      .unwrap()
                      .start()
                      .as_byte_index(file_start),
                );

                let maybe_ident = match &decl.decl {
                  DefaultDecl::Class(decl) => decl.ident.as_ref(),
                  DefaultDecl::Fn(decl) => decl.ident.as_ref(),
                  DefaultDecl::TsInterfaceDecl(_) => {
                    unreachable!();
                  }
                };
                if maybe_ident.is_none() {
                  let start = decl.start().as_byte_index(file_start);
                  module_data.text_changes.push(TextChange {
                    range: start..start,
                    new_text: "const __pack_default__ = ".to_string(),
                  })
                }
              }

              for_each_descendant(
                decl.decl.into(),
                module_data,
                replace_ids,
                module,
                is_root_module,
              );
            }
          }
          Node::ExportDecl(decl) => {
            match &decl.decl {
              Decl::TsInterface(_) | Decl::TsTypeAlias(_) => {
                // remove it
                module_data
                  .add_remove_range(decl.range().as_byte_range(file_start));
              }
              Decl::Class(_)
              | Decl::Fn(_)
              | Decl::Var(_)
              | Decl::TsEnum(_)
              | Decl::TsModule(_) => {
                if !is_root_module {
                  let export_keyword = decl
                    .tokens_fast(module)
                    .iter()
                    .find(|t| {
                      t.token == Token::Word(Word::Keyword(Keyword::Export))
                    })
                    .unwrap();
                  // remove the "export" keyword
                  module_data.add_remove_range(
                    export_keyword.start().as_byte_index(file_start)
                      ..export_keyword
                        .next_token_fast(module)
                        .unwrap()
                        .start()
                        .as_byte_index(file_start),
                  );
                }

                for_each_descendant(
                  decl.decl.into(),
                  module_data,
                  replace_ids,
                  module,
                  is_root_module,
                );
              }
            }
          }
          Node::ImportDecl(_)
          | Node::TsTypeAliasDecl(_)
          | Node::TsInterfaceDecl(_) => {
            module_data
              .add_remove_range(child.range().as_byte_range(file_start));
          }
          _ => {
            for_each_descendant(
              child,
              module_data,
              replace_ids,
              module,
              is_root_module,
            );
          }
        }
      }
    }

    let module_data = context.module_data.get(specifier);
    for_each_descendant(
      module.into(),
      module_data,
      &replace_ids,
      module,
      is_root_module,
    );
  });
  Ok(())
}
