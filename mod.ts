// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** APIs to transpile and bundle JavaScript and TypeScript under Deno and Deno.
 *
 * It is a user loadable module which provides an alternative to the removed
 * unstable `Deno.emit()` API.
 *
 * ### Example - Transpiling
 *
 * ```ts
 * import { emit } from "https://deno.land/x/emit/mod.ts";
 *
 * const url = new URL("./testdata/mod.ts", import.meta.url);
 * const result = await emit(url.href);
 *
 * const { code } = result;
 * console.log(code.includes("export default function hello()"));
 * ```
 *
 * ### Example - Bundling
 *
 * ```ts
 * import { bundle } from "https://deno.land/x/emit/mod.ts";
 * const result = await bundle(
 *   "https://deno.land/std@0.140.0/examples/chat/server.ts",
 * );
 *
 * const { code } = result;
 * console.log(code);
 * ```
 *
 * @module
 */

import { bundle as jsBundle, transpile } from "./lib/deno_emit.generated.js";
import {
  type CacheSetting,
  createCache,
  type FetchCacher,
} from "https://deno.land/x/deno_cache@0.4.1/mod.ts";

/** The output of the {@linkcode bundle} function. */
export interface BundleEmit {
  /** The bundles code as a single JavaScript module. */
  code: string;
  /** An optional source map. */
  map?: string;
}

export interface BundleOptions {
  /** Allow remote modules to be loaded or read from the cache. */
  allowRemote?: boolean;
  /** The cache root to use, overriding the default inferred `DENO_DIR`. */
  cacheRoot?: string;
  /** The setting to use when loading sources from the Deno cache. */
  cacheSetting?: CacheSetting;
  /** Compiler options which can be set when bundling. */
  compilerOptions?: CompilerOptions;
  imports?: Record<string, string[]>;
  /** Override the default loading mechanism with a custom loader. This can
   * provide a way to use "in-memory" resources instead of fetching them
   * remotely. */
  load?: FetchCacher["load"];
  /** Should the emitted bundle be an ES module or an IIFE script. The default
   * is `"module"` to output a ESM module. */
  type?: "module" | "classic";
}

/** Options which can be set when using the {@linkcode emit} function. */
export interface EmitOptions {
  /** Allow remote modules to be loaded or read from the cache. */
  allowRemote?: boolean;
  /** The cache root to use, overriding the default inferred `DENO_DIR`. */
  cacheRoot?: string;
  /** The setting to use when loading sources from the Deno cache. */
  cacheSetting?: CacheSetting;
  //compilerOptions?: CompilerOptions;
  //imports: Record<string, string[]>;
  // load?( specifier: string, isDynamic: boolean,): Promise<LoadResponse | undefined>;
  //type?: "module" | "classic";
}

export interface CompilerOptions {
  checkJs?: boolean;
  /** Determines if reflection meta data is emitted for legacy decorators or
   * not.  Defaults to `false`. */
  emitDecoratorMetadata?: boolean;
  importsNotUsedAsValues?: string;
  /** When set, instead of writing out a `.js.map` file to provide source maps,
   * the source map will be embedded the source map content in the `.js` files.
   *
   * Although this results in larger JS files, it can be convenient in some
   * scenarios. For example, you might want to debug JS files on a webserver
   * that doesn’t allow `.map` files to be served. */
  inlineSourceMap?: boolean;
  /** When set, the original content of the `.ts` file as an embedded string in
   * the source map (using the source map’s `sourcesContent` property).
   *
   * This is often useful in the same cases as `inlineSourceMap`. */
  inlineSources?: boolean;
  /** Controls how JSX constructs are emitted in JavaScript files. This only
   * affects output of JS files that started in `.jsx` or `.tsx` files. */
  jsx?: "jsx" | "preserve";
  /** Changes the function called in `.js` files when compiling JSX Elements
   * using the classic JSX runtime. The most common change is to use `"h"` or
   * `"preact.h"`. */
  jsxFactory?: string;
  /** Specify the JSX fragment factory function to use when targeting react JSX
   * emit with jsxFactory compiler option is specified, e.g. `Fragment`. */
  jsxFragmentFactory?: string;
  /** Enables the generation of sourcemap files. */
  sourceMap?: boolean;
}

/** Generate a single file JavaScript bundle of the root module and its
 * dependencies.
 *
 * ### Example
 *
 * ```ts
 * import { bundle } from "https://deno.land/x/emit/mod.ts";
 * const result = await bundle(
 *   "https://deno.land/std@0.140.0/examples/chat/server.ts",
 * );
 *
 * const { code } = result;
 * console.log(code);
 * ```
 *
 * @param root The root module specifier to use for the bundle.
 * @param options Options to use when bundling.
 * @returns a promise which resolves with the emitted bundle (and optional
 *          source map)
 */
export function bundle(
  root: string | URL,
  options: BundleOptions = {},
): Promise<BundleEmit> {
  const {
    imports,
    load,
    cacheSetting,
    cacheRoot,
    allowRemote,
  } = options;
  let bundleLoad = load;
  if (!bundleLoad) {
    const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
    bundleLoad = cache.load;
  }
  root = root instanceof URL ? root : new URL(root, import.meta.url);
  return jsBundle(
    root.toString(),
    bundleLoad,
    JSON.stringify(imports),
    undefined,
    undefined,
  );
}

/** Transpile TypeScript (or JavaScript) into JavaScript, returning a promise
 * which resolves with a map of the emitted files.
 *
 * @param root The root module specifier to use for the bundle.
 * @param options Options to use when emitting.
 * @returns A promise which resolves with an object map of the emitted files,
 *          where the key is the emitted files name and the value is the
 *          source for the file.
 */
export function emit(
  root: string | URL,
  options: EmitOptions = {},
): Promise<Record<string, string>> {
  root = root instanceof URL ? root : new URL(root, import.meta.url);
  const { cacheSetting, cacheRoot, allowRemote } = options;
  const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
  return transpile(root.toString(), cache.load, undefined);
}
