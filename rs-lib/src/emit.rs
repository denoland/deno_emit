// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

use crate::ast;
use crate::ast::CompilerOptions;
use crate::ast::EmitOptions;
use crate::ast::SourceMapConfig;
use crate::bundle_hook::BundleHook;

use anyhow::anyhow;
use anyhow::Result;
use deno_ast::swc;
use std::collections::HashMap;
use std::rc::Rc;

pub enum BundleType {
  Module,
  Classic,
}

impl From<BundleType> for swc::bundler::ModuleType {
  fn from(bundle_type: BundleType) -> Self {
    match bundle_type {
      BundleType::Classic => Self::Iife,
      BundleType::Module => Self::Es,
    }
  }
}

pub struct BundleOptions {
  pub bundle_type: BundleType,
  pub maybe_compiler_options: Option<CompilerOptions>,
}

#[cfg_attr(feature = "serialization", derive(serde::Serialize))]
#[derive(Debug)]
pub struct BundleEmit {
  pub code: String,
  #[cfg_attr(
    feature = "serialization",
    serde(rename = "map", skip_serializing_if = "Option::is_none")
  )]
  pub maybe_map: Option<String>,
}

struct BundleLoader<'a> {
  cm: Rc<swc::common::SourceMap>,
  emit_options: &'a ast::EmitOptions,
  graph: &'a deno_graph::ModuleGraph,
}

impl swc::bundler::Load for BundleLoader<'_> {
  fn load(
    &self,
    file_name: &swc::common::FileName,
  ) -> Result<swc::bundler::ModuleData> {
    match file_name {
      swc::common::FileName::Url(specifier) => {
        if let Some(m) = self.graph.get(specifier) {
          let source = if let Some(s) = m.maybe_source.as_ref() {
            s.to_string()
          } else {
            "".to_string()
          };
          // FIXME(bartlomieju): this should use `parsed_source.transpile()` instead?
          let (fm, module) = ast::transpile_module(
            specifier,
            &source,
            m.media_type,
            self.emit_options,
            self.cm.clone(),
          )?;
          Ok(swc::bundler::ModuleData {
            fm,
            module,
            helpers: Default::default(),
          })
        } else {
          Err(anyhow!(
            "Module \"{}\" unexpectedly missing when bundling.",
            specifier
          ))
        }
      }
      _ => unreachable!(
        "Received a request for unsupported filename {:?}",
        file_name
      ),
    }
  }
}

struct BundleResolver<'a>(&'a deno_graph::ModuleGraph);

impl swc::bundler::Resolve for BundleResolver<'_> {
  fn resolve(
    &self,
    referrer: &swc::common::FileName,
    specifier: &str,
  ) -> Result<swc::common::FileName> {
    let referrer = if let swc::common::FileName::Url(referrer) = referrer {
      referrer
    } else {
      unreachable!(
        "An unexpected referrer was passed when bundling: {:?}",
        referrer
      );
    };
    if let Some(specifier) =
      self.0.resolve_dependency(specifier, referrer, false)
    {
      Ok(deno_ast::swc::common::FileName::Url(specifier.clone()))
    } else {
      Err(anyhow!(
        "Cannot resolve \"{}\" from \"{}\".",
        specifier,
        referrer
      ))
    }
  }
}

pub fn bundle(
  graph: &deno_graph::ModuleGraph,
  options: BundleOptions,
) -> Result<BundleEmit> {
  let globals = swc::common::Globals::new();
  swc::common::GLOBALS.set(&globals, || {
    let emit_options: EmitOptions = options
      .maybe_compiler_options
      .map_or_else(EmitOptions::default, |co| co.into());
    let source_map_config = SourceMapConfig {
      inline_sources: emit_options.inline_sources,
    };
    let cm = Rc::new(swc::common::SourceMap::new(
      swc::common::FilePathMapping::empty(),
    ));
    let loader = BundleLoader {
      graph,
      emit_options: &emit_options,
      cm: cm.clone(),
    };
    let resolver = BundleResolver(graph);
    let config = swc::bundler::Config {
      module: options.bundle_type.into(),
      ..Default::default()
    };
    // This hook will rewrite the `import.meta` when bundling to give a consistent
    // behavior between bundled and unbundled code.
    let hook = Box::new(BundleHook);
    let mut bundler = swc::bundler::Bundler::new(
      &globals,
      cm.clone(),
      loader,
      resolver,
      config,
      hook,
    );
    let mut entries = HashMap::new();
    entries.insert(
      "bundle".to_string(),
      swc::common::FileName::Url(graph.roots[0].0.clone()),
    );
    let output = bundler.bundle(entries)?;
    let mut buf = Vec::new();
    let mut srcmap = Vec::new();
    {
      let cfg = swc::codegen::Config { minify: false };
      let wr = Box::new(swc::codegen::text_writer::JsWriter::new(
        cm.clone(),
        "\n",
        &mut buf,
        Some(&mut srcmap),
      ));
      let mut emitter = swc::codegen::Emitter {
        cfg,
        cm: cm.clone(),
        comments: None,
        wr,
      };
      emitter.emit_module(&output[0].module)?;
    }
    let mut code = String::from_utf8(buf)?;
    let mut maybe_map: Option<String> = None;
    {
      let mut buf = Vec::new();
      cm.build_source_map_with_config(&mut srcmap, None, source_map_config)
        .to_writer(&mut buf)?;
      if emit_options.inline_source_map {
        let encoded_map = format!(
          "//# sourceMappingURL=data:application/json;base64,{}\n",
          base64::encode(buf)
        );
        code.push_str(&encoded_map);
      } else if emit_options.source_map {
        maybe_map = Some(String::from_utf8(buf)?);
      }
    }

    Ok(BundleEmit { code, maybe_map })
  })
}
