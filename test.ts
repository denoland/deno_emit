// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { join } from "https://deno.land/std@0.140.0/path/mod.ts";
import { bundle, emit } from "./mod.ts";

Deno.test({
  name: "bundle - remote",
  async fn() {
    const result = await bundle(
      new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - url",
  async fn() {
    const result = await bundle(
      new URL(
        "https://deno.land/std@0.140.0/examples/chat/server.ts",
      ),
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - relative",
  async fn() {
    const result = await bundle(
      "./testdata/mod.ts",
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - absolute",
  async fn() {
    const result = await bundle(
      join(Deno.cwd(), "testdata", "mod.ts"),
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "transpile - remote",
  async fn() {
    const result = await emit(
      new URL(
        "https://deno.land/std@0.140.0/examples/chat/server.ts",
      ),
    );

    console.log(result);
    assertEquals(Object.keys(result).length, 18);
    const code =
      result["https://deno.land/std@0.140.0/examples/chat/server.ts"];
    assert(code);
  },
});

Deno.test({
  name: "transpile - url",
  async fn() {
    const result = await emit(
      new URL(
        "https://deno.land/std@0.140.0/examples/chat/server.ts",
      ),
    );

    console.log(result);
    assertEquals(Object.keys(result).length, 18);
    const code =
      result["https://deno.land/std@0.140.0/examples/chat/server.ts"];
    assert(code);
  },
});

Deno.test({
  name: "transpile - relative",
  async fn() {
    const result = await emit("./testdata/mod.ts");

    console.log(result);
    assertEquals(Object.keys(result).length, 1);
    const code = result[Object.keys(result)[0]];
    assert(code);
    assertStringIncludes(code, "export default function hello()");
  },
});

Deno.test({
  name: "transpile - absolute",
  async fn() {
    const result = await emit(join(Deno.cwd(), "testdata", "mod.ts"));

    console.log(result);
    assertEquals(Object.keys(result).length, 1);
    const code = result[Object.keys(result)[0]];
    assert(code);
    assertStringIncludes(code, "export default function hello()");
  },
});
