import { join, toFileUrl } from "https://deno.land/std@0.182.0/path/mod.ts";
import { assertEquals } from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { resolveFixture, runModule, testTranspileAndBundle } from "./utils.ts";

Deno.test({
  name: "embedded",
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
  name: "embedded with specific base url",
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
  name: "local file set as relative path",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: join("testdata", "import_map", "import_map.json"),
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
  name: "local file set as absolute path",
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
  name: "local file set as file url string",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: toFileUrl(resolveFixture("import_map/import_map.json"))
        .toString(),
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
  name: "local file set as file url object",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: toFileUrl(resolveFixture("import_map/import_map.json")),
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
  name: "remote url string",
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
  name: "remote url object",
  fn: testTranspileAndBundle(
    resolveFixture("import_map/main.ts"),
    {
      importMap: new URL("http://localhost:8000/import_map/import_map.json"),
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
