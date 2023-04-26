// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { bundle } from "../js/mod.ts";
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
  name: "source maps generation consistent with tsc",
  async fn(t) {
    type Outcome =
      | "inline source maps"
      | "external source maps"
      | "no source maps"
      | "error";

    interface TestCase {
      compilerOptions: {
        sourceMap?: boolean;
        inlineSourceMap?: boolean;
        inlineSources?: boolean;
      };
      outcome: Outcome;
    }

    const cases: TestCase[] = [
      {
        compilerOptions: {},
        outcome: "no source maps",
      },
      {
        compilerOptions: { sourceMap: false },
        outcome: "no source maps",
      },
      {
        compilerOptions: { inlineSourceMap: false },
        outcome: "no source maps",
      },
      {
        compilerOptions: { sourceMap: false, inlineSourceMap: false },
        outcome: "no source maps",
      },
      {
        compilerOptions: { inlineSources: false },
        outcome: "no source maps",
      },
      {
        compilerOptions: { sourceMap: false, inlineSources: false },
        outcome: "no source maps",
      },
      {
        compilerOptions: { inlineSourceMap: false, inlineSources: false },
        outcome: "no source maps",
      },
      {
        compilerOptions: {
          sourceMap: false,
          inlineSourceMap: false,
          inlineSources: false,
        },
        outcome: "no source maps",
      },
      {
        compilerOptions: { inlineSourceMap: true },
        outcome: "inline source maps",
      },
      {
        compilerOptions: { sourceMap: false, inlineSourceMap: true },
        outcome: "inline source maps",
      },
      {
        compilerOptions: { inlineSourceMap: true, inlineSources: true },
        outcome: "inline source maps",
      },
      {
        compilerOptions: { inlineSourceMap: true, inlineSources: false },
        outcome: "inline source maps",
      },
      {
        compilerOptions: {
          sourceMap: false,
          inlineSourceMap: true,
          inlineSources: true,
        },
        outcome: "inline source maps",
      },
      {
        compilerOptions: {
          sourceMap: false,
          inlineSourceMap: true,
          inlineSources: false,
        },
        outcome: "inline source maps",
      },
      {
        compilerOptions: { sourceMap: true },
        outcome: "external source maps",
      },
      {
        compilerOptions: { sourceMap: true, inlineSourceMap: false },
        outcome: "external source maps",
      },
      {
        compilerOptions: { sourceMap: true, inlineSources: true },
        outcome: "external source maps",
      },
      {
        compilerOptions: { sourceMap: true, inlineSources: false },
        outcome: "external source maps",
      },
      {
        compilerOptions: {
          sourceMap: true,
          inlineSourceMap: false,
          inlineSources: true,
        },
        outcome: "external source maps",
      },
      {
        compilerOptions: {
          sourceMap: true,
          inlineSourceMap: false,
          inlineSources: false,
        },
        outcome: "external source maps",
      },
      {
        compilerOptions: { sourceMap: true, inlineSourceMap: true },
        outcome: "error",
      },
      {
        compilerOptions: { inlineSources: true },
        outcome: "error",
      },
      {
        compilerOptions: { sourceMap: false, inlineSources: true },
        outcome: "error",
      },
      {
        compilerOptions: { inlineSourceMap: false, inlineSources: true },
        outcome: "error",
      },
      {
        compilerOptions: {
          sourceMap: true,
          inlineSourceMap: true,
          inlineSources: true,
        },
        outcome: "error",
      },
      {
        compilerOptions: {
          sourceMap: true,
          inlineSourceMap: true,
          inlineSources: false,
        },
        outcome: "error",
      },
      {
        compilerOptions: {
          sourceMap: false,
          inlineSourceMap: false,
          inlineSources: true,
        },
        outcome: "error",
      },
    ];

    for (const { compilerOptions, outcome } of cases) {
      await t.step({
        name: `${
          outcome === "error" ? "errors" : `emits ${outcome}`
        } when compilerOptions is set to ${JSON.stringify(compilerOptions)}`,
        async fn() {
          function run() {
            return bundle(resolveFixture("mod.ts"), {
              compilerOptions,
            });
          }

          if (outcome === "error") {
            assertRejects(run, "bundle throws an error");
          } else {
            const { code, map } = await run();

            switch (outcome) {
              case "inline source maps":
                assert(
                  code.split("\n").at(-2)?.startsWith(
                    "//# sourceMappingURL=data:application/json;base64,",
                  ),
                  "code contains an inline source map",
                );
                assertEquals(
                  map,
                  undefined,
                  "bundle does not return a source map",
                );
                break;

              case "external source maps":
                assertExists(map, "bundle returns a source map");
                break;

              case "no source maps":
                assert(
                  !code.includes(
                    "//# sourceMappingURL=",
                  ),
                  "code does not reference any source maps",
                );
                assertEquals(
                  map,
                  undefined,
                  "bundle does not return a source map",
                );
                break;

              default:
                throw new Error(`Unexpected outcome: ${outcome}`);
            }
          }
        },
      });
    }
  },
});
