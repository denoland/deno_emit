// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

use anyhow::anyhow;
use deno_emit::CompilerOptions;
use deno_emit::LoadFuture;
use deno_emit::Loader;
use deno_emit::ModuleSpecifier;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

struct JsLoader {
  load: js_sys::Function,
}

impl JsLoader {
  pub fn new(load: js_sys::Function) -> Self {
    Self { load }
  }
}

impl Loader for JsLoader {
  fn load(
    &mut self,
    specifier: &ModuleSpecifier,
    is_dynamic: bool,
  ) -> LoadFuture {
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
  // todo(dsherret): eliminate all the duplicate `.map_err`s
  let maybe_imports_map: Option<HashMap<String, Vec<String>>> = maybe_imports
    .into_serde()
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  let maybe_compiler_options: Option<CompilerOptions> = maybe_compiler_options
    .into_serde()
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  let root = ModuleSpecifier::parse(&root)
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  let mut loader = JsLoader::new(load);

  let result = deno_emit::bundle(
    root,
    &mut loader,
    maybe_bundle_type,
    maybe_imports_map,
    maybe_compiler_options,
  )
  .await
  .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;

  JsValue::from_serde(&result)
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
  let mut loader = JsLoader::new(load);

  let map = deno_emit::transpile(root, &mut loader)
    .await
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;

  JsValue::from_serde(&map)
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))
}
