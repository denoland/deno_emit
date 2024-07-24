# emit

[![deno emit](https://jsr.io/badges/@deno/emit)](https://jsr.io/@deno/emit)

Transpile and bundle JavaScript and TypeScript in Deno and Deno Deploy.

> This is an unstable module, where the API is likely to change over time.

## Transpiling

Take individual modules that are JavaScript or TypeScript and emit them in a
transpiled fashion. An example of taking some TypeScript and transpiling to
JavaScript:

```ts
import { transpile } from "jsr:@deno/emit";

const url = new URL("./testdata/mod.ts", import.meta.url);
const result = await transpile(url);

const code = result.get(url.href);
console.log(code?.includes("export default function hello()"));
```

## Bundle

Take a root module and all its dependencies and emit a single JavaScript bundle.
This is similar to the functionality provided by `deno bundle` on the Deno
command line. An example:

```ts
import { bundle } from "jsr:@deno/emit";
const result = await bundle(
  new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
);

const { code } = result;
console.log(code);
```
