// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

mod bundle_hook;
mod emit;
mod text;

use anyhow::Result;
use deno_graph::CapturingModuleParser;
use deno_graph::DefaultModuleAnalyzer;
use deno_graph::DefaultParsedSourceStore;
use deno_graph::ParsedSourceStore;
use std::collections::HashMap;

pub use emit::bundle_graph;
pub use emit::BundleEmit;
pub use emit::BundleOptions;
pub use emit::BundleType;

pub use deno_ast::EmitOptions;
pub use deno_ast::ImportsNotUsedAsValues;
pub use deno_ast::ModuleSpecifier;
pub use deno_graph::source::LoadFuture;
pub use deno_graph::source::Loader;

pub async fn bundle(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
  maybe_imports_map: Option<Vec<(ModuleSpecifier, Vec<String>)>>,
  bundle_options: BundleOptions,
) -> Result<BundleEmit> {
  let graph = deno_graph::create_graph(
    vec![(root, deno_graph::ModuleKind::Esm)],
    false,
    maybe_imports_map,
    loader,
    None,
    None,
    None,
    None,
  )
  .await;

  bundle_graph(&graph, bundle_options)
}

pub async fn transpile(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
) -> Result<HashMap<String, String>> {
  let maybe_imports = None;

  let store = DefaultParsedSourceStore::default();
  let parser = CapturingModuleParser::new(None, &store);
  let analyzer = DefaultModuleAnalyzer::new(&parser);
  let graph = deno_graph::create_graph(
    vec![(root, deno_graph::ModuleKind::Esm)],
    false,
    maybe_imports,
    loader,
    None,
    None,
    Some(&analyzer),
    None,
  )
  .await;

  graph.valid()?;

  let mut map = HashMap::new();

  for module in graph.modules() {
    if let Some(parsed_source) = store.get_parsed_source(&module.specifier) {
      // TODO: add emit options
      let emit_options = Default::default();
      let transpiled_source = parsed_source.transpile(&emit_options)?;

      map.insert(module.specifier.to_string(), transpiled_source.text);
      if let Some(source_map) = &transpiled_source.source_map {
        map.insert(
          format!("{}.map", module.specifier.as_str()),
          source_map.to_string(),
        );
      }
    }
  }

  Ok(map)
}
