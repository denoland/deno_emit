// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

// todo: consolidate with dnt

use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;

use anyhow::anyhow;
use anyhow::Result;
use deno_ast::ModuleSpecifier;
use deno_graph::source::LoadResponse;
use deno_graph::source::Loader;
use futures::Future;

type RemoteFileText = Arc<str>;
type RemoteFileHeaders = Option<HashMap<String, String>>;
type RemoteFileResult = Result<(RemoteFileText, RemoteFileHeaders), String>;

fn url_to_file_path(module_specifier: &ModuleSpecifier) -> Result<PathBuf> {
  // module_specifier.to_file_path() does not work in a cross platform way
  // and it does not work in Wasm
  assert!(module_specifier.scheme() == "file");
  let path_segments = module_specifier
    .path_segments()
    .unwrap()
    .collect::<Vec<_>>();
  let mut final_text = String::new();
  for segment in path_segments.iter() {
    if !final_text.is_empty() {
      final_text.push('/');
    }
    final_text.push_str(segment);
  }
  if !is_windows_path_segment(path_segments[0]) {
    final_text = format!("/{}", final_text);
  }
  Ok(PathBuf::from(final_text))
}

fn is_windows_path_segment(specifier: &str) -> bool {
  let mut chars = specifier.chars();

  let first_char = chars.next();
  if first_char.is_none() || !first_char.unwrap().is_ascii_alphabetic() {
    return false;
  }

  if chars.next() != Some(':') {
    return false;
  }

  chars.next().is_none()
}

#[derive(Clone, Default)]
pub struct InMemoryLoader {
  modules: HashMap<ModuleSpecifier, RemoteFileResult>,
}

impl InMemoryLoader {
  pub fn add_file(
    &mut self,
    specifier: impl AsRef<str>,
    text: impl AsRef<str>,
  ) -> &mut Self {
    let specifier = specifier.as_ref();
    let specifier =
      if !specifier.starts_with("http") && !specifier.starts_with("file") {
        ModuleSpecifier::parse(&format!("file:///{}", specifier)).unwrap()
      } else {
        ModuleSpecifier::parse(specifier).unwrap()
      };
    self.modules.insert(
      ModuleSpecifier::parse(specifier.as_ref()).unwrap(),
      Ok((text.as_ref().into(), None)),
    );
    self
  }

  pub fn add_file_with_headers(
    &mut self,
    specifier: impl AsRef<str>,
    text: impl AsRef<str>,
    headers: &[(&str, &str)],
  ) -> &mut Self {
    let headers = headers
      .iter()
      .map(|(key, value)| (key.to_string(), value.to_string()))
      .collect();
    self.modules.insert(
      ModuleSpecifier::parse(specifier.as_ref()).unwrap(),
      Ok((text.as_ref().into(), Some(headers))),
    );
    self
  }

  pub fn add_file_with_error(
    &mut self,
    specifier: impl AsRef<str>,
    error_text: impl AsRef<str>,
  ) -> &mut Self {
    self.modules.insert(
      ModuleSpecifier::parse(specifier.as_ref()).unwrap(),
      Err(error_text.as_ref().to_string()),
    );
    self
  }
}

impl Loader for InMemoryLoader {
  fn load(
    &mut self,
    specifier: &ModuleSpecifier,
    is_dynamic: bool,
  ) -> Pin<Box<dyn Future<Output = Result<Option<LoadResponse>>> + 'static>> {
    let specifier = specifier.clone();
    let result = self.modules.get(&specifier).map(|result| match result {
      Ok(result) => Ok(LoadResponse::Module {
        specifier, // todo: test a re-direct
        content: result.0.clone(),
        maybe_headers: result.1.clone(),
      }),
      Err(err) => Err(err),
    });
    let result = match result {
      Some(Ok(result)) => Ok(Some(result)),
      Some(Err(err)) => Err(anyhow!("{}", err)),
      None => Ok(None),
    };
    Box::pin(futures::future::ready(result))
  }
}
