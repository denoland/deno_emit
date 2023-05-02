// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { toFileUrl } from "https://deno.land/std@0.182.0/path/mod.ts";
import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { bundle, transpile } from "../js/mod.ts";
import {
  resolveFixture,
  runCode,
  runModule,
  testTranspileAndBundle,
} from "./utils.ts";

// Most of the tests below have been ported and adapted from deno bundle's test
// suite. Some of them are ignored; see the comments for more details.

Deno.test({
  name: "hello world",
  fn: testTranspileAndBundle(
    resolveFixture("hello_world.ts"),
    undefined,
    async ({ outputFileUrl }) => {
      const output = await runModule(outputFileUrl);
      assertEquals(output, "Hello world!\n");
    },
  ),
});

Deno.test({
  name: "hello world relative path",
  fn: testTranspileAndBundle("./testdata/hello_world.ts"),
});

Deno.test({
  name: "file url as string",
  fn: testTranspileAndBundle(
    toFileUrl(resolveFixture("hello_world.ts")).toString(),
  ),
  // TODO: Support URLs without wrapping in an object. See https://github.com/denoland/deno_emit/issues/62.
  ignore: true,
});

Deno.test({
  name: "remote url as string",
  fn: testTranspileAndBundle(
    "https://deno.land/std@0.140.0/examples/chat/server.ts",
  ),
  // TODO: Support URLs without wrapping in an object. See https://github.com/denoland/deno_emit/issues/62.
  ignore: true,
});

Deno.test({
  name: "file url as object",
  fn: testTranspileAndBundle(toFileUrl(resolveFixture("hello_world.ts"))),
});

Deno.test({
  name: "remote url as object",
  fn: testTranspileAndBundle(
    new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
  ),
});

Deno.test({
  name: "load override",
  fn: testTranspileAndBundle(new URL("file:///src.ts"), {
    async load(specifier) {
      if (specifier !== "file:///src.ts") return undefined;
      const content = await Deno.readTextFile(resolveFixture("hello_world.ts"));
      return { kind: "module", specifier, content };
    },
  }),
});

Deno.test({
  name: "exports",
  fn: testTranspileAndBundle(
    resolveFixture("mod1.ts"),
    undefined,
    async ({ outputFileUrl, denoConfigPath }) => {
      const output = await runCode(
        `import { printHello3 } from "${outputFileUrl}";\n printHello3();`,
        denoConfigPath,
      );
      assertEquals(output, "Hello\n");

      // TODO: See with https://github.com/denoland/deno_emit/issues/106 if we
      // should also test for the presence of ignore directives.
    },
  ),
});

Deno.test({
  name: "top level await",
  fn: testTranspileAndBundle(
    resolveFixture("top_level_await.ts"),
    undefined,
    async ({ outputFileUrl, denoConfigPath }) => {
      const output = await runCode(
        `import { tla } from "${outputFileUrl}";\n console.log(tla);`,
        denoConfigPath,
      );
      assertEquals(output, "Hello\n");
    },
  ),
});

Deno.test({
  name: "js",
  fn: testTranspileAndBundle(
    resolveFixture("js_module.js"),
    undefined,
    async ({ outputFileUrl, denoConfigPath }) => {
      await runModule(outputFileUrl, denoConfigPath);
    },
  ),
});

Deno.test({
  name: "dynamic import",
  fn: testTranspileAndBundle(
    resolveFixture("dynamic_import.ts"),
    undefined,
    async ({ outputFileUrl, denoConfigPath }) => {
      const output = await runModule(outputFileUrl, denoConfigPath);
      assertEquals(output, "Hello\n");
    },
  ),
  // TODO: Determine whether we want to support dynamic imports. If so, we need
  // a way to run a local server.
  ignore: true,
});

Deno.test({
  name: "error with bare import",
  async fn(t) {
    // TODO: Better error message
    await t.step("bundle", async () => {
      await assertRejects(() => {
        return bundle(resolveFixture("error_with_bare_import.ts"));
      });
    });
    await t.step("transpile", async () => {
      await assertRejects(() => {
        return transpile(resolveFixture("error_with_bare_import.ts"));
      });
    });
  },
});

Deno.test({
  name: "import map",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      // importMap: resolveFixture("import_map/import_map.json"),
    },
    async ({ outputFileUrl, denoConfigPath }) => {
      const output = await runCode(
        `import { printHello3 } from "${outputFileUrl}";\n printHello3();`,
        denoConfigPath,
      );
      assertEquals(output, "Hello\n");
    },
  ),
  // TODO: Support import maps.
  // See https://github.com/denoland/deno_emit/issues/67.
  ignore: true,
});

Deno.test({
  name: "jsx import from ts",
  fn: testTranspileAndBundle(resolveFixture("jsx_import_from_ts.ts")),
});

Deno.test({
  name: "ts decorators",
  fn: testTranspileAndBundle(resolveFixture("ts_decorators.ts")),
});

Deno.test({
  name: "export specifier with alias",
  fn: testTranspileAndBundle(resolveFixture("exports_with_alias.ts")),
});

Deno.test({
  name: "preserve shebang",
  fn: testTranspileAndBundle(
    resolveFixture("shebang.ts"),
    undefined,
    ({ outputCode }) => {
      assertStringIncludes(
        outputCode,
        "#!/usr/bin/env -S deno run --allow-read\n",
      );
    },
  ),
  // TODO: Shebangs are not preserved, but they should be.
  ignore: true,
});
