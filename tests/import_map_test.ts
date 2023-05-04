import { toFileUrl } from "https://deno.land/std@0.182.0/path/mod.ts";
import { assertEquals } from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { resolveFixture, runModule, testTranspileAndBundle } from "./utils.ts";

Deno.test({
  name: "embedded import map",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: {
        imports: {
          "foo": "./testdata/subdir/foo.ts",
        },
      },
    },
    async ({ outputFileUrl, denoConfigPath, functionCalled }) => {
      if (functionCalled === "bundle") {
        const output = await runModule(outputFileUrl, denoConfigPath);
        assertEquals(output, "foo\n");
      }
    },
  ),
});

Deno.test({
  name: "embedded import map with specific base url",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: {
        baseUrl: toFileUrl(resolveFixture(".")),
        imports: {
          "foo": "./subdir/foo.ts",
        },
      },
    },
    async ({ outputFileUrl, denoConfigPath, functionCalled }) => {
      if (functionCalled === "bundle") {
        const output = await runModule(outputFileUrl, denoConfigPath);
        assertEquals(output, "foo\n");
      }
    },
  ),
});

Deno.test({
  name: "import map as local file",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: resolveFixture("import_map/import_map.json"),
    },
    async ({ outputFileUrl, denoConfigPath, functionCalled }) => {
      if (functionCalled === "bundle") {
        const output = await runModule(outputFileUrl, denoConfigPath);
        assertEquals(output, "foo\n");
      }
    },
  ),
});

Deno.test({
  name: "import map as remote file",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: "http://localhost:8000/import_map/import_map.json",
    },
    async ({ outputFileUrl, denoConfigPath, functionCalled }) => {
      if (functionCalled === "bundle") {
        const output = await runModule(outputFileUrl, denoConfigPath);
        assertEquals(output, "foo\n");
      }
    },
  ),
  // TODO: Run a local server to be able to test this.
  ignore: true,
});

Deno.test({
  name: "empty import map",
  fn: testTranspileAndBundle(
    resolveFixture("mod1.ts"),
    { importMap: {} },
  ),
});
