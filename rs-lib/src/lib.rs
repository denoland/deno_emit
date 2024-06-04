// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

#![deny(clippy::print_stderr)]
#![deny(clippy::print_stdout)]

mod bundle_hook;
mod emit;
mod text;

use anyhow::Result;
use deno_graph::source::ResolveError;
use deno_graph::BuildOptions;
use deno_graph::CapturingModuleAnalyzer;
use deno_graph::GraphKind;
use deno_graph::ModuleGraph;
use deno_graph::ParsedSourceStore;
use deno_graph::Range;
use import_map::ImportMap;
use import_map::ImportMapOptions;
use std::collections::HashMap;
use url::Url;

pub use emit::bundle_graph;
pub use emit::BundleEmit;
pub use emit::BundleOptions;
pub use emit::BundleType;

pub use deno_ast::EmitOptions;
pub use deno_ast::ImportsNotUsedAsValues;
pub use deno_ast::ModuleSpecifier;
pub use deno_ast::SourceMapOption;
pub use deno_ast::TranspileOptions;
pub use deno_graph::source::CacheSetting;
pub use deno_graph::source::LoadFuture;
pub use deno_graph::source::LoadOptions;
pub use deno_graph::source::Loader;
pub use deno_graph::source::LoaderChecksum;

pub async fn bundle(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
  maybe_import_map: Option<ImportMapInput>,
  options: BundleOptions,
) -> Result<BundleEmit> {
  let maybe_import_map = get_import_map_from_input(&maybe_import_map)?;
  let import_map_resolver = ImportMapResolver(maybe_import_map);
  let mut graph = ModuleGraph::new(GraphKind::CodeOnly);
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
  maybe_import_map: Option<ImportMapInput>,
  transpile_options: &TranspileOptions,
  emit_options: &EmitOptions,
) -> Result<HashMap<String, Vec<u8>>> {
  let analyzer = CapturingModuleAnalyzer::default();
  let maybe_import_map = get_import_map_from_input(&maybe_import_map)?;
  let import_map_resolver = ImportMapResolver(maybe_import_map);
  let mut graph = ModuleGraph::new(GraphKind::CodeOnly);
  graph
    .build(
      vec![root],
      loader,
      BuildOptions {
        module_analyzer: &analyzer,
        resolver: Some(import_map_resolver.as_resolver()),
        ..Default::default()
      },
    )
    .await;

  graph.valid()?;

  let mut map = HashMap::new();

  for module in graph.modules().filter_map(|m| m.js()) {
    if let Some(parsed_source) =
      analyzer.remove_parsed_source(&module.specifier)
    {
      let transpiled_source = parsed_source
        .transpile(transpile_options, emit_options)?
        .into_source();

      map.insert(module.specifier.to_string(), transpiled_source.source);

      if let Some(source_map) = transpiled_source.source_map {
        map.insert(format!("{}.map", module.specifier.as_str()), source_map);
      }
    }
  }

  Ok(map)
}

#[derive(Debug)]
pub struct ImportMapInput {
  pub base_url: Url,
  pub json_string: String,
}

fn get_import_map_from_input(
  maybe_input: &Option<ImportMapInput>,
) -> Result<Option<ImportMap>> {
  if let Some(input) = maybe_input {
    let import_map = import_map::parse_from_json_with_options(
      &input.base_url,
      &input.json_string,
      ImportMapOptions {
        address_hook: None,
        // always do this for simplicity
        expand_imports: true,
      },
    )?
    .import_map;
    Ok(Some(import_map))
  } else {
    Ok(None)
  }
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
    referrer_range: &Range,
    _mode: deno_graph::source::ResolutionMode,
  ) -> Result<ModuleSpecifier, ResolveError> {
    let maybe_import_map = &self.0;

    let maybe_import_map_err =
      match maybe_import_map.as_ref().map(|import_map| {
        import_map.resolve(specifier, &referrer_range.specifier)
      }) {
        Some(Ok(value)) => return Ok(value),
        Some(Err(err)) => Some(err),
        None => None,
      };

    if let Some(err) = maybe_import_map_err {
      Err(ResolveError::Other(err.into()))
    } else {
      deno_graph::resolve_import(specifier, &referrer_range.specifier)
        .map_err(|err| err.into())
    }
  }
}
