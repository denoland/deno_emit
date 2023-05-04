// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

mod bundle_hook;
mod emit;
mod text;

use anyhow::Result;
use deno_graph::BuildOptions;
use deno_graph::CapturingModuleAnalyzer;
use deno_graph::ModuleGraph;
use deno_graph::ParsedSourceStore;
use std::collections::HashMap;
use url::Url;

pub use emit::bundle_graph;
pub use emit::BundleEmit;
pub use emit::BundleOptions;
pub use emit::BundleType;
pub use emit::TranspileOptions;

pub use deno_ast::EmitOptions;
pub use deno_ast::ImportsNotUsedAsValues;
pub use deno_ast::ModuleSpecifier;
pub use deno_graph::source::LoadFuture;
pub use deno_graph::source::Loader;
pub use import_map::ImportMap;

pub async fn bundle(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
  maybe_import_map: Option<ImportMap>,
  options: BundleOptions,
) -> Result<BundleEmit> {
  let import_map_resolver = ImportMapResolver(maybe_import_map);
  let mut graph = ModuleGraph::default();
  graph
    .build(
      vec![root],
      loader,
      BuildOptions {
        resolver: Some(import_map_resolver.as_resolver()),
        ..Default::default()
      },
    )
    .await;

  bundle_graph(&graph, options)
}

pub async fn transpile(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
  maybe_import_map: Option<ImportMap>,
  options: TranspileOptions,
) -> Result<HashMap<String, String>> {
  let analyzer = CapturingModuleAnalyzer::default();
  let import_map_resolver = ImportMapResolver(maybe_import_map);
  let mut graph = ModuleGraph::default();
  graph
    .build(
      vec![root],
      loader,
      BuildOptions {
        module_analyzer: Some(&analyzer),
        resolver: Some(import_map_resolver.as_resolver()),
        ..Default::default()
      },
    )
    .await;

  graph.valid()?;

  let mut map = HashMap::new();

  for module in graph.modules().filter_map(|m| m.esm()) {
    if let Some(parsed_source) = analyzer.get_parsed_source(&module.specifier) {
      let transpiled_source = parsed_source.transpile(&options.emit_options)?;

      map.insert(module.specifier.to_string(), transpiled_source.text);
      // TODO: Understand why parsed_source.transpile returns a source map
      // even when options.emit_options.source_map is false.
      if options.emit_options.source_map {
        if let Some(source_map) = &transpiled_source.source_map {
          map.insert(
            format!("{}.map", module.specifier.as_str()),
            source_map.to_string(),
          );
        }
      }
    }
  }

  Ok(map)
}

pub fn parse_import_map(
  base_url: &str,
  json_string: &str,
) -> Result<ImportMap> {
  let base_url = Url::parse(base_url)?;
  let import_map =
    import_map::parse_from_json(&base_url, json_string)?.import_map;
  Ok(import_map)
}

#[derive(Debug)]
struct ImportMapResolver(Option<import_map::ImportMap>);

impl ImportMapResolver {
  pub fn as_resolver(&self) -> &dyn deno_graph::source::Resolver {
    self
  }
}

impl deno_graph::source::Resolver for ImportMapResolver {
  fn resolve(
    &self,
    specifier: &str,
    referrer: &ModuleSpecifier,
  ) -> Result<ModuleSpecifier, anyhow::Error> {
    let maybe_import_map = &self.0;

    let maybe_import_map_err = match maybe_import_map
      .as_ref()
      .map(|import_map| import_map.resolve(specifier, referrer))
    {
      Some(Ok(value)) => return Ok(value),
      Some(Err(err)) => Some(err),
      None => None,
    };

    if let Some(err) = maybe_import_map_err {
      Err(err.into())
    } else {
      deno_graph::resolve_import(specifier, referrer).map_err(|err| err.into())
    }
  }
}
