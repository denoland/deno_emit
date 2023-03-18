// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

use crate::integration::TestBuilder;

mod integration;

#[tokio::test]
async fn test_pack() {
  let mut builder = TestBuilder::new();
  builder.with_loader(|loader| {
    loader.add_file("file:///mod.ts", r#"
import { logger, Logger } from './logger.ts';

const myLogger: Logger = {
  log(...args: any[]) {
    logger.log(...args);
  }
}

console.log(myLogger.log("Hello"));
"#);
    loader.add_file("file:///logger.ts", r#"
export interface Logger {
  log(...args: any[]): void;
}

export const logger: Logger = { log(...args: any[]) { console.log(...args); }};"#);
  });

  assert_eq!(
    builder.pack().await.unwrap(),
    r#"// file:///logger.ts
namespace pack0 {
export interface Logger {
  log(...args: any[]): void;
}

export const logger: Logger = { log(...args: any[]) { console.log(...args); }};
}

// file:///mod.ts
const myLogger: pack0.Logger = {
  log(...args: any[]) {
    pack0.logger.log(...args);
  }
}

console.log(myLogger.log("Hello"));
"#
  );
}
