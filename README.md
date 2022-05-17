# Deno.emit in user-space

In Deno 1.22, the unstable API `Deno.emit` was removed. This module provides a
userspace implementation of it.

https://deno.land/x/emit


## Transpile

```ts
import { emit } from "https://deno.land/x/emit@0.0.1/mod.ts";
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.138.0/testing/asserts.ts";

const url = new URL("./testdata/mod.ts", import.meta.url);
const result = await emit(url.href);

console.log(result);
assertEquals(Object.keys(result).length, 1);
const code = result[Object.keys(result)[0]];
assert(code)
assertStringIncludes(code, "export default function hello()");
```

## Bundle


```ts
import { bundle } from "https://deno.land/x/emit@0.0.1/mod.ts";
const result = await bundle(
  "https://deno.land/std@0.113.0/examples/chat/server.ts",
);
console.log(result);
assert(result.code);
```

## Type-check

TODO
