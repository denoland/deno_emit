// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { resolveFixture, runModule, testBundle } from "./utils.ts";

Deno.test({
  name: "json import",
  fn: testBundle(
    resolveFixture("json_import.ts"),
    undefined,
    async ({ outputFileUrl }) => {
      const output = await runModule(outputFileUrl);
      assertStringIncludes(output, "with space");
    },
  ),
});

Deno.test({
  name: "json import escape",
  fn: testBundle(
    resolveFixture("json_import_escape.ts"),
    undefined,
    async ({ outputFileUrl, result }) => {
      const output = await runModule(outputFileUrl);
      assertStringIncludes(
        output,
        "a value with newline\n, \"double quotes\", 'single quotes', ${jsInterpolation} and `string literal`",
      );

      // This is done on purpose, as `String.raw` still performs a string interpolation,
      // and we want a literal value as is, without any modifications.
      // We should not need to escape $, { nor ` as they are JSON-safe characters.
      const jsInterpolation = "${jsInterpolation} and `string literal`";
      assertStringIncludes(
        result.code,
        String
          .raw`const __default = JSON.parse("\"a value with newline\\n, \\\"double quotes\\\", 'single quotes', ${jsInterpolation}\"");`,
      );
    },
  ),
});

Deno.test({
    name: "minified json import",
    fn: testBundle(
        resolveFixture("json_import.ts"),
        { minify: true },
        async ({ outputFileUrl }) => {
            const output = await runModule(outputFileUrl);
            assertStringIncludes(output, "with space");
        },
    ),
});

Deno.test({
  name: "circular",
  fn: testBundle(
    resolveFixture("circular1.ts"),
    undefined,
    async ({ outputFileUrl }) => {
      const output = await runModule(outputFileUrl);
      assertEquals(output, "f2\nf1\n");
    },
  ),
});
