// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.138.0/testing/asserts.ts";
import { bundle, emit } from "./mod.ts";

Deno.test({
  name: "bundle - basic",
  async fn() {
    const result = await bundle(
      "https://deno.land/std@0.113.0/examples/chat/server.ts",
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "transpile - basic",
  async fn() {
    const url = new URL("./testdata/mod.ts", import.meta.url);
    const result = await emit(url.href);

    console.log(result);
    assertEquals(Object.keys(result).length, 1);
    const code = result[Object.keys(result)[0]];
    assert(code)
    assertStringIncludes(code, "export default function hello()");
  },
});
