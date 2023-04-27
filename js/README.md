# emit

[![deno emit](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/emit/mod.ts)

Transpile and bundle JavaScript and TypeScript in Deno and Deno Deploy.

> This is an unstable module, where the API is likely to change over time.

## Transpiling

Take individual modules that are JavaScript or TypeScript and emit them in a
transpiled fashion. An example of taking some TypeScript and transpiling to
JavaScript:

```ts
import { transpile } from "https://deno.land/x/emit/mod.ts";

const url = new URL("./testdata/mod.ts", import.meta.url);
const result = await transpile(url);

const code = result[url.href];
console.log(code.includes("export default function hello()"));
```

## Bundle

Take a root module and all its dependencies and emit a single JavaScript bundle.
This is similar to the functionality provided by `deno bundle` on the Deno
command line. An example:

```ts
import { bundle } from "https://deno.land/x/emit/mod.ts";
const result = await bundle(
  new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
);

const { code } = result;
console.log(code);
```
