import { toFileUrl } from "https://deno.land/std@0.182.0/path/mod.ts";
import { assertEquals } from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { resolveFixture, runModule, testTranspileAndBundle } from "./utils.ts";

Deno.test({
  name: "embedded import map",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      imports: {
        "foo": "./testdata/subdir/foo.ts",
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
      baseUrl: toFileUrl(resolveFixture(".")),
      imports: {
        "foo": "./subdir/foo.ts",
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
  name: "embedded import map takes precedence over file",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: resolveFixture("import_map/import_map.json"),
      imports: {
        "foo": "./testdata/subdir/foo2.ts",
      },
    },
    async ({ outputFileUrl, denoConfigPath, functionCalled }) => {
      if (functionCalled === "bundle") {
        const output = await runModule(outputFileUrl, denoConfigPath);
        assertEquals(output, "foo2\n");
      }
    },
  ),
});
