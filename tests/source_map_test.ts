import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.182.0/testing/asserts.ts";
import { toFileUrl } from "https://deno.land/std@0.182.0/path/mod.ts";
import { bundle, transpile } from "../js/mod.ts";
import { resolveFixture } from "./utils.ts";

type Outcome =
  | "inline source maps"
  | "external source maps"
  | "no source maps"
  | "error";

interface CompilerOptions {
  sourceMap?: boolean;
  inlineSourceMap?: boolean;
  inlineSources?: boolean;
}

interface TestCase {
  compilerOptions: CompilerOptions | undefined;
  outcome: Outcome;
}

const cases: TestCase[] = [
  {
    compilerOptions: undefined,
    outcome: "no source maps",
  },
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

interface Output {
  code: string;
  map?: string;
}

async function testSourceMapBehavior(
  t: Deno.TestContext,
  fn: (options?: CompilerOptions) => Promise<Output>,
): Promise<void> {
  for (const { compilerOptions, outcome } of cases) {
    await t.step({
      name: `${
        outcome === "error" ? "errors" : `emits ${outcome}`
      } when compilerOptions is set to ${JSON.stringify(compilerOptions)}`,
      async fn() {
        const run = fn.bind(null, compilerOptions);

        if (outcome === "error") {
          await assertRejects(run, "bundle throws an error");
        } else {
          const { code, map } = await run();

          switch (outcome) {
            case "inline source maps":
              assert(
                code.trim().split("\n").at(-1)?.startsWith(
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
}

Deno.test({
  name: "source maps generation consistent with tsc",
  async fn(t) {
    await t.step("transpile", async (t) => {
      await testSourceMapBehavior(t, async (compilerOptions) => {
        const filePath = resolveFixture("hello_world.ts");
        const fileUrl = toFileUrl(filePath).toString();
        const sourceMapUrl = `${fileUrl}.map`;

        const result = await transpile(filePath, { compilerOptions });
        return {
          code: result[fileUrl],
          map: result[sourceMapUrl],
        };
      });
    });

    await t.step("bundle", async (t) => {
      await testSourceMapBehavior(t, async (compilerOptions) => {
        const result = await bundle(resolveFixture("hello_world.ts"), {
          compilerOptions,
        });
        return result;
      });
    });
  },
});
