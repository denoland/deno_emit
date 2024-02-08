import {
  resolveFixture,
  testTranspile,
  testTranspileAndBundle,
} from "./utils.ts";

Deno.test({
  name: "jsx default",
  fn: testTranspileAndBundle(
    resolveFixture("jsx/main.tsx"),
  ),
});

Deno.test({
  name: "jsx type react",
  fn: testTranspileAndBundle(
    resolveFixture("jsx/main.tsx"),
    {
      compilerOptions: {
        jsx: "react",
      },
    },
  ),
});

Deno.test({
  name: "jsx type react-native",
  fn: testTranspileAndBundle(
    resolveFixture("jsx/main.tsx"),
    {
      compilerOptions: {
        jsx: "react-native",
      },
    },
  ),
});

Deno.test({
  name: "jsx type preserve",
  fn: testTranspileAndBundle(
    resolveFixture("jsx/main.tsx"),
    {
      compilerOptions: {
        jsx: "preserve",
      },
    },
  ),
});

Deno.test({
  name: "jsx type react-jsx",
  fn: testTranspile(
    resolveFixture("jsx/main.tsx"),
    {
      compilerOptions: {
        jsx: "react-jsx",
      },
    },
  ),
});

Deno.test({
  name: "jsx type react-jsx with custom import source",
  fn: testTranspile(
    resolveFixture("jsx/main.tsx"),
    {
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "example",
      },
    },
  ),
});
