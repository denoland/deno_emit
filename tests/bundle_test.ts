// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { assertStringIncludes } from "https://deno.land/std@0.182.0/testing/asserts.ts";
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
  fn: testBundle(resolveFixture("escape.ts"), undefined, (result) => {
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
