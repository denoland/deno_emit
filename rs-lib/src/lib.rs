// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

mod bundle_hook;
mod emit;
mod pack;
mod text;

use anyhow::Result;
use deno_graph::BuildOptions;
use deno_graph::CapturingModuleAnalyzer;
use deno_graph::ModuleGraph;
use deno_graph::ParsedSourceStore;
use deno_graph::ReferrerImports;
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

pub use pack::pack;
pub use pack::pack_dts;
pub use pack::PackOptions;

pub async fn bundle(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
  maybe_imports_map: Option<Vec<(ModuleSpecifier, Vec<String>)>>,
  bundle_options: BundleOptions,
) -> Result<BundleEmit> {
  let mut graph = ModuleGraph::default();
  graph
    .build(
      vec![root],
      loader,
      BuildOptions {
        imports: maybe_imports_map
          .unwrap_or_default()
          .into_iter()
          .map(|(referrer, imports)| (ReferrerImports { referrer, imports }))
          .collect(),
        ..Default::default()
      },
    )
    .await;

  bundle_graph(&graph, bundle_options)
}

pub async fn transpile(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
) -> Result<HashMap<String, String>> {
  let analyzer = CapturingModuleAnalyzer::default();
  let mut graph = ModuleGraph::default();
  graph
    .build(
      vec![root],
      loader,
      BuildOptions {
        module_analyzer: Some(&analyzer),
        ..Default::default()
      },
    )
    .await;

  graph.valid()?;

  let mut map = HashMap::new();

  for module in graph.modules().filter_map(|m| m.esm()) {
    if let Some(parsed_source) = analyzer.get_parsed_source(&module.specifier) {
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
