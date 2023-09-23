import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { toFileUrl } from "https://deno.land/std@0.182.0/path/mod.ts";
import { transpile } from "../js/mod.ts";
import { resolveFixture } from "./utils.ts";

type ExpectedOutputFile =
  | "out_no_transforms.js"
  | "out_react.js"
  | "out_react_jsx.js"
  | "out_react_jsx_custom_import_source.js";

interface CompilerOptions {
  jsx?: "preserve" | "react-jsx" | "react-jsxdev" | "react-native" | "react";
  jsxImportSource?: string;
  jsxFactory?: string;
  jsxFragmentFactory?: string;
}

interface TestCase {
  compilerOptions: CompilerOptions | undefined;
  expectedError?: boolean;
  expectedOutput?: ExpectedOutputFile;
}

const cases: TestCase[] = [
  {
    compilerOptions: {},
    expectedOutput: "out_react.js",
  },
  {
    compilerOptions: { jsx: "react" },
    expectedOutput: "out_react.js",
  },
  {
    compilerOptions: { jsx: "react-native" },
    expectedOutput: "out_no_transforms.js",
  },
  {
    compilerOptions: { jsx: "preserve" },
    expectedOutput: "out_no_transforms.js",
  },

  {
    compilerOptions: { jsx: "react-jsx" },
    expectedOutput: "out_react_jsx.js",
  },

  {
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "example" },
    expectedOutput: "out_react_jsx_custom_import_source.js",
  },
];

async function testJSXTransform(
  t: Deno.TestContext,
  testCase: TestCase,
  fn: (options?: CompilerOptions) => Promise<string>,
): Promise<void> {
  await t.step({
    name: `${
      testCase.expectedError ? "errors" : `emits ${testCase.expectedOutput}`
    } when compilerOptions is set to ${
      JSON.stringify(testCase.compilerOptions)
    }`,
    async fn() {
      const run = fn.bind(null, testCase.compilerOptions);

      if (testCase.expectedError) {
        await assertRejects(run, "bundle throws an error");
      } else {
        const generatedContent = await run();

        const filePath = resolveFixture(`jsx/${testCase.expectedOutput}`);
        const expectedContent = await Deno.readTextFile(filePath);

        assertEquals(
          generatedContent,
          expectedContent,
          "unexpected generated jsx code",
        );
      }
    },
  });
}

Deno.test({
  name: "jsx compiler options are respected",
  async fn(t) {
    await t.step("transpile", async (t) => {
      for (const testCase of cases) {
        await testJSXTransform(t, testCase, async (compilerOptions) => {
          const filePath = resolveFixture("jsx/in.tsx");
          const fileUrl = toFileUrl(filePath).toString();

          const result = await transpile(filePath, { compilerOptions });
          const code = result.get(fileUrl);
          assertExists(code);
          return code;
        });
      }
    });
  },
});
