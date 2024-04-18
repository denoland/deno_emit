// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

use anyhow::anyhow;
use deno_emit::BundleOptions;
use deno_emit::BundleType;
use deno_emit::EmitOptions;
use deno_emit::ImportMapInput;
use deno_emit::ImportsNotUsedAsValues;
use deno_emit::LoadFuture;
use deno_emit::LoadOptions;
use deno_emit::Loader;
use deno_emit::ModuleSpecifier;
use deno_emit::SourceMapOption;
use deno_emit::TranspileOptions;
use serde::Serialize;
use url::Url;
use wasm_bindgen::prelude::*;

/// This is a deserializable structure of the `"compilerOptions"` section of a
/// TypeScript or Deno configuration file which can effect how the emitting is
/// handled, all other options don't impact the output.
#[derive(serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
#[derive(Debug)]
pub struct CompilerOptions {
  pub check_js: bool,
  pub experimental_decorators: bool,
  pub emit_decorator_metadata: bool,
  pub imports_not_used_as_values: String,
  pub inline_source_map: bool,
  pub inline_sources: bool,
  pub jsx: String,
  pub jsx_factory: String,
  pub jsx_fragment_factory: String,
  pub jsx_import_source: Option<String>,
  pub source_map: bool,
}

impl CompilerOptions {
  pub fn into_options(self) -> (TranspileOptions, EmitOptions) {
    let imports_not_used_as_values =
      match self.imports_not_used_as_values.as_str() {
        "preserve" => ImportsNotUsedAsValues::Preserve,
        "error" => ImportsNotUsedAsValues::Error,
        _ => ImportsNotUsedAsValues::Remove,
      };

    // copied from the CLI
    let (transform_jsx, jsx_automatic, jsx_development, precompile_jsx) =
      match self.jsx.as_str() {
        "react" => (true, false, false, false),
        "react-jsx" => (true, true, false, false),
        "react-jsxdev" => (true, true, true, false),
        "precompile" => (false, false, false, true),
        _ => (false, false, false, false),
      };
    let source_map = if self.inline_source_map {
      SourceMapOption::Inline
    } else if self.source_map {
      SourceMapOption::Separate
    } else {
      SourceMapOption::None
    };

    (
      TranspileOptions {
        use_decorators_proposal: !self.experimental_decorators,
        use_ts_decorators: self.experimental_decorators,
        emit_metadata: self.emit_decorator_metadata,
        imports_not_used_as_values,
        jsx_factory: self.jsx_factory,
        jsx_fragment_factory: self.jsx_fragment_factory,
        transform_jsx,
        var_decl_imports: false,
        jsx_automatic,
        jsx_development,
        jsx_import_source: self.jsx_import_source,
        precompile_jsx,
      },
      EmitOptions {
        inline_sources: self.inline_sources,
        keep_comments: true,
        source_map,
      },
    )
  }
}

impl Default for CompilerOptions {
  fn default() -> Self {
    Self {
      experimental_decorators: false,
      check_js: false,
      emit_decorator_metadata: false,
      imports_not_used_as_values: "remove".to_string(),
      inline_source_map: false,
      inline_sources: false,
      jsx: "react".to_string(),
      jsx_factory: "React.createElement".to_string(),
      jsx_fragment_factory: "React.Fragment".to_string(),
      jsx_import_source: None,
      source_map: false,
    }
  }
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ImportMapJsInput {
  base_url: String,
  json_string: String,
}

impl TryFrom<ImportMapJsInput> for ImportMapInput {
  type Error = anyhow::Error;

  fn try_from(js_input: ImportMapJsInput) -> anyhow::Result<Self> {
    Ok(ImportMapInput {
      base_url: Url::parse(&js_input.base_url)?,
      json_string: js_input.json_string,
    })
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
    &self,
    specifier: &ModuleSpecifier,
    options: LoadOptions,
  ) -> LoadFuture {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct JsLoadOptions {
      pub is_dynamic: bool,
      pub cache_setting: &'static str,
      pub checksum: Option<String>,
    }

    let specifier = specifier.clone();
    let this = JsValue::null();
    let arg0 = JsValue::from(specifier.to_string());
    let arg1 = serde_wasm_bindgen::to_value(&JsLoadOptions {
      is_dynamic: options.is_dynamic,
      cache_setting: options.cache_setting.as_js_str(),
      checksum: options.maybe_checksum.map(|c| c.into_string()),
    })
    .unwrap();
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
        .map(|value| serde_wasm_bindgen::from_value(value).unwrap())
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
  maybe_import_map: JsValue,
  maybe_compiler_options: JsValue,
  minify: bool,
) -> Result<JsValue, JsValue> {
  console_error_panic_hook::set_once();
  // todo(dsherret): eliminate all the duplicate `.map_err`s
  let compiler_options: CompilerOptions = serde_wasm_bindgen::from_value::<
    Option<CompilerOptions>,
  >(maybe_compiler_options)
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?
  .unwrap_or_default();
  let root = ModuleSpecifier::parse(&root)
    .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?;
  let mut loader = JsLoader::new(load);
  let (transpile_options, emit_options) = compiler_options.into_options();
  let bundle_type = match maybe_bundle_type.as_deref() {
    Some("module") | None => BundleType::Module,
    Some("classic") => BundleType::Classic,
    Some(value) => {
      return Err(JsValue::from(js_sys::Error::new(&format!(
        "Unsupported bundle type \"{value}\"",
      ))))
    }
  };
  let maybe_import_map = serde_wasm_bindgen::from_value::<
    Option<ImportMapJsInput>,
  >(maybe_import_map)
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?
  .map(|js_input| {
    let result: anyhow::Result<ImportMapInput> = js_input.try_into();
    result
  })
  .transpose()
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?;

  let result = deno_emit::bundle(
    root,
    &mut loader,
    maybe_import_map,
    BundleOptions {
      bundle_type,
      emit_options,
      emit_ignore_directives: false,
      transpile_options,
      minify,
    },
  )
  .await
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?;

  serde_wasm_bindgen::to_value(&SerializableBundleEmit {
    code: result.code,
    maybe_map: result.maybe_map,
  })
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))
}

#[wasm_bindgen]
pub async fn transpile(
  root: String,
  load: js_sys::Function,
  maybe_import_map: JsValue,
  maybe_compiler_options: JsValue,
) -> Result<JsValue, JsValue> {
  console_error_panic_hook::set_once();
  let compiler_options: CompilerOptions = serde_wasm_bindgen::from_value::<
    Option<CompilerOptions>,
  >(maybe_compiler_options)
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?
  .unwrap_or_default();
  let root = ModuleSpecifier::parse(&root)
    .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?;
  let mut loader = JsLoader::new(load);
  let (transpile_options, emit_options) = compiler_options.into_options();

  let maybe_import_map = serde_wasm_bindgen::from_value::<
    Option<ImportMapJsInput>,
  >(maybe_import_map)
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?
  .map(|js_input| {
    let result: anyhow::Result<ImportMapInput> = js_input.try_into();
    result
  })
  .transpose()
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?;

  let map = deno_emit::transpile(
    root,
    &mut loader,
    maybe_import_map,
    &transpile_options,
    &emit_options,
  )
  .await
  .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))?;

  serde_wasm_bindgen::to_value(&map)
    .map_err(|err| JsValue::from(js_sys::Error::new(&format!("{:#}", err))))
}
