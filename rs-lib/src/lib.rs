// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

mod ast;
mod bundle_hook;
mod emit;
mod text;
mod transforms;

use anyhow::bail;
use anyhow::Result;
use emit::BundleEmit;
use std::collections::HashMap;

pub use ast::CompilerOptions;
pub use deno_ast::ModuleSpecifier;
pub use deno_graph::source::LoadFuture;
pub use deno_graph::source::Loader;

pub async fn bundle(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
  maybe_bundle_type: Option<String>,
  maybe_imports_map: Option<HashMap<String, Vec<String>>>,
  maybe_compiler_options: Option<CompilerOptions>,
) -> Result<BundleEmit> {
  let mut maybe_imports = None;
  if let Some(imports_map) = maybe_imports_map {
    let mut imports = Vec::new();
    for (referrer_str, specifier_vec) in imports_map.into_iter() {
      let referrer = ModuleSpecifier::parse(&referrer_str)?;
      imports.push((referrer, specifier_vec));
    }
    maybe_imports = Some(imports);
  }
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
  let bundle_type = match maybe_bundle_type.as_deref() {
    Some("module") | None => emit::BundleType::Module,
    Some("classic") => emit::BundleType::Classic,
    Some(value) => {
      bail!("Unsupported bundle type \"{}\"", value);
    }
  };
  emit::bundle(
    &graph,
    emit::BundleOptions {
      bundle_type,
      maybe_compiler_options,
    },
  )
}

pub async fn transpile(
  root: ModuleSpecifier,
  loader: &mut dyn Loader,
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
