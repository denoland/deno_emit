// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

mod bundle_hook;
mod emit;
mod text;

use anyhow::Result;
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
  emitopts: EmitOptions,
) -> Result<HashMap<String, String>> {
  let maybe_imports = None;

  let graph = deno_graph::create_graph(
    vec![(root, deno_graph::ModuleKind::Esm)],
    false,
    maybe_imports,
    loader,
    None,
    None,
    None,
    None,
  )
  .await;

  graph.valid()?;

  let mut map = HashMap::new();

  for module in graph.modules() {
    if let Some(parsed_source) = &module.maybe_parsed_source {
      let transpiled_source = parsed_source.transpile(&emitopts)?;
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
