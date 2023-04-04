// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { resolveFixture, testTranspile } from "./utils.ts";

// FIXME: This repeats the test below. Consider supporting URLs without wrapping
// in a URL object.
Deno.test({
  name: "remote",
  fn: testTranspile(
    new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
  ),
});

Deno.test({
  name: "url",
  fn: testTranspile(
    new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
  ),
});

Deno.test({
  name: "relative",
  fn: testTranspile("./testdata/mod.ts"),
});

Deno.test({
  name: "absolute",
  fn: testTranspile(resolveFixture("mod.ts")),
});

Deno.test({
  name: "source",
  fn: testTranspile(new URL("file:///src.ts"), {
    async load(specifier) {
      if (specifier !== "file:///src.ts") return undefined;
      const content = await Deno.readTextFile(resolveFixture("mod.ts"));
      return { kind: "module", specifier, content };
    },
  }),
});
