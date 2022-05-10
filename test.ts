// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import { bundle, emit } from "./mod.ts";

Deno.test({
  name: "bundle - basic",
  async fn() {
    const result = await bundle(
      "https://deno.land/std@0.113.0/examples/chat/server.ts",
    );
    console.log(result);
  },
});

Deno.test({
  name: "transpile - basic",
  async fn() {
    const url = new URL("./testdata/mod.ts", import.meta.url);
    const result = await emit(url.href);
    console.log(result);
  },
});
