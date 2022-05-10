// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

mod ast;
mod bundle_hook;
mod emit;
mod text;
mod transforms;

use anyhow::anyhow;
use deno_ast::ModuleSpecifier;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  // Use `js_namespace` here to bind `console.log(..)` instead of just
  // `log(..)`
  #[wasm_bindgen(js_namespace = console)]
  fn log(s: &str);
}

struct JsLoader {
  load: js_sys::Function,
}

impl JsLoader {
  pub fn new(load: js_sys::Function) -> Self {
    Self { load }
  }
}

impl deno_graph::source::Loader for JsLoader {
  fn load(
    &mut self,
    specifier: &ModuleSpecifier,
    is_dynamic: bool,
  ) -> deno_graph::source::LoadFuture {
    let specifier = specifier.clone();
    let this = JsValue::null();
    let arg0 = JsValue::from(specifier.to_string());
    let arg1 = JsValue::from(is_dynamic);
    let result = self.load.call2(&this, &arg0, &arg1);
    let f = async move {
      let response = match result {
        Ok(result) => {
          wasm_bindgen_futures::JsFuture::from(js_sys::Promise::resolve(
            &result,
          ))
          .await
        }
        Err(err) => Err(err),
      };

      response
        .map(|value| value.into_serde().unwrap())
        .map_err(|_| anyhow!("load rejected or errored"))
    };
    Box::pin(f)
  }
}

#[wasm_bindgen]
pub async fn bundle(
  root: String,
  load: js_sys::Function,
  maybe_bundle_type: Option<String>,
  maybe_imports: JsValue,
  maybe_compiler_options: JsValue,
) -> Result<JsValue, JsValue> {
  let maybe_imports_map: Option<HashMap<String, Vec<String>>> = maybe_imports
    .into_serde()
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  let maybe_compiler_options: Option<ast::CompilerOptions> =
    maybe_compiler_options
      .into_serde()
      .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  let root = ModuleSpecifier::parse(&root)
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  let mut loader = JsLoader::new(load);
  let mut maybe_imports = None;
  if let Some(imports_map) = maybe_imports_map {
    let mut imports = Vec::new();
    for (referrer_str, specifier_vec) in imports_map.into_iter() {
      let referrer = ModuleSpecifier::parse(&referrer_str)
        .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
      imports.push((referrer, specifier_vec));
    }
    maybe_imports = Some(imports);
  }
  let graph = deno_graph::create_graph(
    vec![(root, deno_graph::ModuleKind::Esm)],
    false,
    maybe_imports,
    &mut loader,
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
      return Err(JsValue::from(js_sys::Error::new(&format!(
        "Unsupported bundle type \"{}\"",
        value
      ))))
    }
  };
  let bundle_emit = emit::bundle(
    &graph,
    emit::BundleOptions {
      bundle_type,
      maybe_compiler_options,
    },
  )
  .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  JsValue::from_serde(&bundle_emit)
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))
}

#[wasm_bindgen]
pub async fn transpile(
  root: String,
  load: js_sys::Function,
  _options: JsValue,
) -> Result<JsValue, JsValue> {
  let root = ModuleSpecifier::parse(&root)
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;

  let maybe_imports = None;

  let mut loader = JsLoader::new(load);

  let graph = deno_graph::create_graph(
    vec![(root, deno_graph::ModuleKind::Esm)],
    false,
    maybe_imports,
    &mut loader,
    None,
    None,
    None,
    None,
  )
  .await;

  graph
    .valid()
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;

  let mut map = HashMap::new();

  for module in graph.modules() {
    if let Some(parsed_source) = &module.maybe_parsed_source {
      // TODO remove unwrap
      let emit_options = Default::default();
      let transpiled_source = parsed_source.transpile(&emit_options).unwrap();

      map.insert(module.specifier.to_string(), transpiled_source.text);
    }
  }

  // JsValue::from_serde(&map)
  //   .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))
  todo!()
}
