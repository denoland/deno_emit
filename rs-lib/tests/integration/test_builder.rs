// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use deno_ast::parse_module;
use deno_ast::Diagnostic;
use deno_ast::MediaType;
use deno_ast::ModuleSpecifier;
use deno_ast::ParseParams;
use deno_ast::ParsedSource;
use deno_ast::SourceTextInfo;
use deno_emit::pack;
use deno_graph::BuildOptions;
use deno_graph::CapturingModuleAnalyzer;
use deno_graph::ModuleParser;

use super::InMemoryLoader;

pub struct TestBuilder {
  loader: InMemoryLoader,
  entry_point: String,
}

impl TestBuilder {
  pub fn new() -> Self {
    let loader = InMemoryLoader::new();
    Self {
      loader,
      entry_point: "file:///mod.ts".to_string(),
    }
  }

  pub fn with_loader(
    &mut self,
    mut action: impl FnMut(&mut InMemoryLoader),
  ) -> &mut Self {
    action(&mut self.loader);
    self
  }

  pub fn entry_point(&mut self, value: impl AsRef<str>) -> &mut Self {
    self.entry_point = value.as_ref().to_string();
    self
  }

  pub async fn pack(&self) -> Result<String> {
    let roots = vec![ModuleSpecifier::parse(&self.entry_point).unwrap()];
    let source_parser = ScopeAnalysisParser::default();
    let capturing_analyzer =
      CapturingModuleAnalyzer::new(Some(Box::new(source_parser)), None);
    let mut graph = deno_graph::ModuleGraph::new(deno_graph::GraphKind::All);
    graph
      .build(
        roots,
        &mut self.loader.clone(),
        BuildOptions {
          is_dynamic: false,
          imports: Vec::new(),
          resolver: None,
          module_analyzer: Some(&capturing_analyzer),
          reporter: None,
          npm_resolver: None,
        },
      )
      .await;
    graph.valid()?;
    pack(&graph, &capturing_analyzer.as_capturing_parser())
  }
}

// todo: move down into deno_ast because this is used in dnt too

#[derive(Default)]
pub struct ScopeAnalysisParser;

impl ModuleParser for ScopeAnalysisParser {
  fn parse_module(
    &self,
    specifier: &ModuleSpecifier,
    source: Arc<str>,
    media_type: MediaType,
  ) -> Result<ParsedSource, Diagnostic> {
    parse_module(ParseParams {
      specifier: specifier.to_string(),
      text_info: SourceTextInfo::new(source),
      media_type,
      capture_tokens: true,
      scope_analysis: true,
      maybe_syntax: None,
    })
  }
}
