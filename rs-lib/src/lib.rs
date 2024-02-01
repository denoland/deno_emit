// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

mod bundle_hook;
mod emit;
mod text;

use anyhow::Result;
use deno_graph::source::LoadResponse;
use deno_graph::source::ResolveError;
use deno_graph::BuildOptions;
use deno_graph::CapturingModuleAnalyzer;
use deno_graph::GraphKind;
use deno_graph::ModuleGraph;
use deno_graph::ParsedSourceStore;
use deno_graph::Range;
use import_map::ImportMap;
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
pub use deno_graph::source::CacheSetting;
pub use deno_graph::source::LoadFuture;
pub use deno_graph::source::Loader;

pub async fn bundle(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
  maybe_import_map: Option<ImportMapInput>,
  options: BundleOptions,
) -> Result<BundleEmit> {
  let maybe_import_map =
    get_import_map_from_input(&maybe_import_map, loader).await?;
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
  options: TranspileOptions,
) -> Result<HashMap<String, String>> {
  let analyzer = CapturingModuleAnalyzer::default();
  let maybe_import_map =
    get_import_map_from_input(&maybe_import_map, loader).await?;
  let import_map_resolver = ImportMapResolver(maybe_import_map);
  let mut graph = ModuleGraph::new(GraphKind::CodeOnly);
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

  for module in graph.modules().filter_map(|m| m.js()) {
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

#[derive(Debug)]
pub enum ImportMapInput {
  ModuleSpecifier(ModuleSpecifier),
  Json { base_url: Url, json_string: String },
}

async fn get_import_map_from_input(
  maybe_input: &Option<ImportMapInput>,
  loader: &mut dyn Loader,
) -> Result<Option<ImportMap>> {
  if let Some(input) = maybe_input {
    match input {
      ImportMapInput::ModuleSpecifier(url) => {
        let response = loader
          .load(url, false, CacheSetting::Use)
          .await?
          .ok_or_else(|| {
            anyhow::anyhow!("Could not find import map {}", url)
          })?;
        match response {
          LoadResponse::External { specifier } => Err(anyhow::anyhow!(
            "Did not expect external import map {}",
            specifier
          )),
          LoadResponse::Module {
            content,
            specifier,
            maybe_headers: _,
          } => {
            let import_map = import_map::parse_from_json(
              &specifier,
              &String::from_utf8(content.to_vec())?,
            )?
            .import_map;
            Ok(Some(import_map))
          }
        }
      }
      ImportMapInput::Json {
        base_url,
        json_string,
      } => {
        let import_map =
          import_map::parse_from_json(base_url, json_string)?.import_map;
        Ok(Some(import_map))
      }
    }
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
