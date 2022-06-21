# emit

[![deno emit](https://doc.deno.land/badge.svg)](https://doc.deno.land/https://deno.land/x/emit/mod.ts)
[![Twitter handle][]][Twitter badge]
[![Discord Chat](https://img.shields.io/discord/684898665143206084?logo=discord&style=social)](https://discord.gg/deno)

Transpile and bundle JavaScript and TypeScript in Deno and Deno Deploy.

> This is an unstable module, where the API is likely to change over time.

## Why was `Deno.emit()` removed from Deno?

In Deno 1.22 the unstable API `Deno.emit()` was removed. This module provides
similar functionality as an optional user loaded module.

Having any APIs that are platform specific (e.g. in the `Deno` namespace) makes
code a lot less portable. We have generally avoided adding APIs to the `Deno`
namespace if we can. While `Deno.emit()` and similar APIs have been part of the
unstable features for an extended period of time, creating
[deno_emit](https://deno.land/x/deno_emit),
[deno_doc](https://deno.land/x/deno_doc) and
[deno_cache](https://deno.land/x/deno_cache), which expose some of the internal
Deno APIs as user loadable modules has proven to be a good pattern for giving
the command line power of the Deno CLI to build end-user solutions, which also
then can work on edge compute like [Deno Deploy](https://deno.com/deploy).

So while taking away functionality from the Deno CLI may seem like a strange
decision, by moving it to a user loadable module, it provides users more choice
and flexibility.

> Note: the examples below use "unpinned" version of the module. Consider using
> a "pinned" version (e.g. `https://deno.land/x/emit@0.0.1/mod.ts` instead.)

## Transpiling

Take individual modules that are JavaScript or TypeScript and emit them in a
transpiled fashion. An example of taking some TypeScript and transpiling to
JavaScript:

```ts
import { emit } from "https://deno.land/x/emit/mod.ts";

const url = new URL("./testdata/mod.ts", import.meta.url);
const result = await emit(url.href);

const { code } = result;
console.log(code.includes("export default function hello()"));
```

## Bundle

Take a root module and all its dependencies and emit a single JavaScript bundle.
This is similar to the functionality provided by `deno bundle` on the Deno
command line. An example:

```ts
import { bundle } from "https://deno.land/x/emit/mod.ts";
const result = await bundle(
  "https://deno.land/std@0.140.0/examples/chat/server.ts",
);

const { code } = result;
console.log(code);
```

## Type checking

Currently _emit_ does not perform type checking, while the prior `Deno.emit()`
could. Getting type checking to run under Deno is a complex process. While we
want to provide a user loadable solution for this, it is unlikely that it will
be provided as part of this module, or would exist as a separate loadable module
as part of this one.

---

Copyright 2018-2022 the Deno authors. All rights reserved. MIT License.

[Build Status - Cirrus]: https://github.com/denoland/deno_emit/workflows/ci/badge.svg?branch=main&event=push
[Build status]: https://github.com/denoland/deno_emit/actions
[Twitter badge]: https://twitter.com/intent/follow?screen_name=deno_land
[Twitter handle]: https://img.shields.io/twitter/follow/deno_land.svg?style=social&label=Follow
