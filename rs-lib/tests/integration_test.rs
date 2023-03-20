// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

use pretty_assertions::assert_eq;

use crate::integration::TestBuilder;

mod integration;

#[tokio::test]
async fn test_pack_named_and_namespace_imports() {
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

  let expected_output = r#"const pack0 = {
  logger: undefined,
};

// file:///logger.ts
(() => {
const logger: Logger = { log(...args: any[]) { console.log(...args); }};
pack0.logger = logger;
})();

// file:///mod.ts
const myLogger: pack0.Logger = {
  log(...args: any[]) {
    pack0.logger.log(...args);
  }
}

console.log(myLogger.log("Hello"));
"#;

  assert_eq!(builder.pack().await.unwrap(), expected_output,);

  // now try changing mod.ts to use a namespace import
  builder.with_loader(|loader| {
    loader.add_file(
      "file:///mod.ts",
      r#"
import * as logger from './logger.ts';

const myLogger: logger.Logger = {
  log(...args: any[]) {
    logger.logger.log(...args);
  }
}

console.log(myLogger.log("Hello"));
"#,
    );
  });

  // the output should be the same
  assert_eq!(builder.pack().await.unwrap(), expected_output,);
}

#[tokio::test]
async fn test_pack_default_exports() {
  let mut builder = TestBuilder::new();
  builder.with_loader(|loader| {
    loader.add_file(
      "file:///mod.ts",
      r#"
import Default1 from './a.ts';
import Default2 from './b.ts';
import Default3 from './c.ts';
import Default4 from './d.ts';
import Default5 from './e.ts';

type Test = Default1;
console.log(Default2);
console.log(Default3);
console.log(Default4);
console.log(Default5);
"#,
    );
    loader.add_file(
      "file:///a.ts",
      r#"
export default interface A {
}
"#,
    );
    loader.add_file(
      "file:///b.ts",
      r#"
export default class B {}
"#,
    );
    loader.add_file(
      "file:///c.ts",
      r#"
export default class {}
"#,
    );
    loader.add_file(
      "file:///d.ts",
      r#"
export default function d() {}
"#,
    );
    loader.add_file(
      "file:///e.ts",
      r#"
export default function() {}
"#,
    );
  });

  let expected_output = r#"const pack1 = {
  default: undefined,
};
const pack2 = {
  default: undefined,
};
const pack3 = {
  default: undefined,
};
const pack4 = {
  default: undefined,
};

// file:///e.ts
(() => {
const __pack_default__ = function() {}
pack4.default = __pack_default__;
})();

// file:///d.ts
(() => {
function d() {}
pack3.default = d;
})();

// file:///c.ts
(() => {
const __pack_default__ = class {}
pack2.default = __pack_default__;
})();

// file:///b.ts
(() => {
class B {}
pack1.default = B;
})();

// file:///a.ts
(() => {
export default
})();

// file:///mod.ts
console.log(pack1.default);
console.log(pack2.default);
console.log(pack3.default);
console.log(pack4.default);
"#;

  assert_eq!(builder.pack().await.unwrap(), expected_output,);
}

#[tokio::test]
async fn test_pack_json_module() {
  let mut builder = TestBuilder::new();
  builder.with_loader(|loader| {
    loader.add_file(
      "file:///mod.ts",
      r#"
import myJson from './data.json' assert {
  type: "json"
};
console.log(myJson.data);
"#,
    );
    loader.add_file(
      "file:///data.json",
      r#"{
  "data": 5
}"#,
    );
  });

  let expected_output = r#"// file:///data.json
const pack0 = {
  default: {
  "data": 5
}
};

// file:///mod.ts
console.log(pack0.default.data);
"#;

  assert_eq!(builder.pack().await.unwrap(), expected_output);
}
