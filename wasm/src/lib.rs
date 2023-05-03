// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

use anyhow::anyhow;
use deno_emit::BundleOptions;
use deno_emit::BundleType;
use deno_emit::EmitOptions;
use deno_emit::ImportsNotUsedAsValues;
use deno_emit::LoadFuture;
use deno_emit::Loader;
use deno_emit::ModuleSpecifier;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// This is a deserializable structure of the `"compilerOptions"` section of a
/// TypeScript or Deno configuration file which can effect how the emitting is
/// handled, all other options don't impact the output.
#[derive(serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
#[derive(Debug)]
pub struct CompilerOptions {
  pub check_js: bool,
  pub emit_decorator_metadata: bool,
  pub imports_not_used_as_values: String,
  pub inline_source_map: bool,
  pub inline_sources: bool,
  pub jsx: String,
  pub jsx_factory: String,
  pub jsx_fragment_factory: String,
  pub source_map: bool,
}

impl Default for CompilerOptions {
  fn default() -> Self {
    Self {
      check_js: false,
      emit_decorator_metadata: false,
      imports_not_used_as_values: "remove".to_string(),
      inline_source_map: false,
      inline_sources: false,
      jsx: "react".to_string(),
      jsx_factory: "React.createElement".to_string(),
      jsx_fragment_factory: "React.Fragment".to_string(),
      source_map: false,
    }
  }
}

impl From<CompilerOptions> for EmitOptions {
  fn from(options: CompilerOptions) -> Self {
    let imports_not_used_as_values =
      match options.imports_not_used_as_values.as_str() {
        "preserve" => ImportsNotUsedAsValues::Preserve,
        "error" => ImportsNotUsedAsValues::Error,
        _ => ImportsNotUsedAsValues::Remove,
      };

    Self {
      emit_metadata: options.emit_decorator_metadata,
      imports_not_used_as_values,
      inline_source_map: options.inline_source_map,
      inline_sources: options.inline_sources,
      jsx_factory: options.jsx_factory,
      jsx_fragment_factory: options.jsx_fragment_factory,
      transform_jsx: options.jsx == "react",
      var_decl_imports: false,
      source_map: options.source_map,
      jsx_automatic: false,
      jsx_development: false,
      jsx_import_source: None,
    }
  }
}

#[derive(serde::Serialize, Debug)]
pub struct SerializableBundleEmit {
  pub code: String,
  #[cfg_attr(
    feature = "serialization",
    serde(rename = "map", skip_serializing_if = "Option::is_none")
  )]
  pub maybe_map: Option<String>,
}

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
        .map_err(|err| anyhow!("load rejected or errored: {:#?}", err))
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
  let compiler_options: CompilerOptions = maybe_compiler_options
    .into_serde::<Option<CompilerOptions>>()
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?
    .unwrap_or_default();
  let root = ModuleSpecifier::parse(&root)
    .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
  let mut loader = JsLoader::new(load);
  let emit_options: EmitOptions = compiler_options.into();
  let bundle_type = match maybe_bundle_type.as_deref() {
    Some("module") | None => BundleType::Module,
    Some("classic") => BundleType::Classic,
    Some(value) => {
      return Err(JsValue::from(js_sys::Error::new(&format!(
        "Unsupported bundle type \"{value}\"",
      ))))
    }
  };

  let maybe_imports = if let Some(imports_map) = maybe_imports_map {
    let mut imports = Vec::new();
    for (referrer_str, specifier_vec) in imports_map.into_iter() {
      let referrer = ModuleSpecifier::parse(&referrer_str)
        .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;
      imports.push((referrer, specifier_vec));
    }
    Some(imports)
  } else {
    None
  };

  let result = deno_emit::bundle(
    root,
    &mut loader,
    maybe_imports,
    BundleOptions {
      bundle_type,
      emit_options,
      emit_ignore_directives: false,
    },
  )
  .await
  .map_err(|err| JsValue::from(js_sys::Error::new(&err.to_string())))?;

  JsValue::from_serde(&SerializableBundleEmit {
    code: result.code,
    maybe_map: result.maybe_map,
  })
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
