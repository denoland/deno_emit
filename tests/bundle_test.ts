// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  assert,
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { resolveFixture, testBundle } from "./utils.ts";

// FIXME: This repeats the test below. Consider supporting URLs without wrapping
// in a URL object.
Deno.test({
  name: "remote",
  fn: testBundle(
    new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
  ),
});

Deno.test({
  name: "url",
  fn: testBundle(
    new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
  ),
});

Deno.test({
  name: "relative",
  fn: testBundle("./testdata/mod.ts"),
});

Deno.test({
  name: "absolute",
  fn: testBundle(resolveFixture("mod.ts")),
});

Deno.test({
  name: "source",
  fn: testBundle(new URL("file:///src.ts"), {
    async load(specifier) {
      if (specifier !== "file:///src.ts") return undefined;
      const content = await Deno.readTextFile(resolveFixture("mod.ts"));
      return { kind: "module", specifier, content };
    },
  }),
});

Deno.test({
  name: "json escapes",
  fn: testBundle(resolveFixture("escape.ts"), undefined, ({ result }) => {
    // This is done on purpose, as `String.raw` still performs a string interpolation,
    // and we want a literal value ${jsInterpolation" as is, without any modifications.
    // We should not need to escape `$` nor `{` as they are both JSON-safe characters.
    const jsInterpolation = "${jsInterpolation}";
    assertStringIncludes(
      result.code,
      String
        .raw`const __default = JSON.parse("{\n  \"key\": \"a value with newline\\n, \\\"double quotes\\\", 'single quotes', and ${jsInterpolation}\"\n}");`,
    );
  }),
});

Deno.test({
  name: "inline source maps are enabled by default",
  fn: testBundle(resolveFixture("mod.ts"), undefined, ({ result }) => {
    assertEquals(result.map, undefined);
    assert(
      result.code.split("\n").at(-2)?.startsWith(
        "//# sourceMappingURL=data:application/json;base64,",
      ),
    );
  }),
});

Deno.test({
  name: "setting inlineSourceMap to true produces inline source maps",
  fn: testBundle(resolveFixture("mod.ts"), {
    compilerOptions: {
      inlineSourceMap: true,
    },
  }, ({ result }) => {
    assertEquals(result.map, undefined);
    assert(
      result.code.split("\n").at(-2)?.startsWith(
        "//# sourceMappingURL=data:application/json;base64,",
      ),
    );
  }),
});

Deno.test({
  name: "setting inlineSourceMap does not produce any source maps",
  fn: testBundle(resolveFixture("mod.ts"), {
    compilerOptions: {
      inlineSourceMap: false,
    },
  }, ({ result }) => {
    assertEquals(result.map, undefined);
    assert(
      !result.code.includes(
        "//# sourceMappingURL=data:application/json;base64,",
      ),
    );
  }),
});

Deno.test({
  name:
    "setting sourceMap to true is not enough to produce external source maps as inline takes precedence",
  fn: testBundle(resolveFixture("mod.ts"), {
    compilerOptions: {
      inlineSourceMap: false,
    },
  }, ({ result }) => {
    assertEquals(result.map, undefined);
    assert(
      !result.code.includes(
        "//# sourceMappingURL=data:application/json;base64,",
      ),
    );
  }),
});

Deno.test({
  name:
    "setting sourceMap to true and inlineSourceMap to false produces external source maps",
  fn: testBundle(resolveFixture("mod.ts"), {
    compilerOptions: {
      sourceMap: true,
      inlineSourceMap: false,
    },
  }, ({ result }) => {
    assertExists(result.map);
    assert(
      !result.code.includes(
        "//# sourceMappingURL=data:application/json;base64,",
      ),
    );
  }),
});
