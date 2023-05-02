// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

/** APIs to transpile and bundle JavaScript and TypeScript under Deno and Deno.
 *
 * It is a user loadable module which provides an alternative to the removed
 * unstable `Deno.emit()` API.
 *
 * ### Example - Transpiling
 *
 * ```ts
 * import { transpile } from "https://deno.land/x/emit/mod.ts";
 *
 * const url = new URL("./testdata/mod.ts", import.meta.url);
 * const result = await transpile(url.href);
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

// run `deno task build` to build this
import { instantiate } from "./emit.generated.js";
import {
  type CacheSetting,
  createCache,
  type FetchCacher,
} from "https://deno.land/x/deno_cache@0.4.1/mod.ts";
import { resolve, toFileUrl } from "https://deno.land/std@0.140.0/path/mod.ts";

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
  /** Base URL to resolve import map specifiers. Defaults to `Deno.cwd()`.
   * Ignored if `imports` is not set. */
  baseUrl?: URL | string;
  /** The setting to use when loading sources from the Deno cache. */
  cacheSetting?: CacheSetting;
  /** Compiler options which can be set when bundling. */
  compilerOptions?: CompilerOptions;
  /** Location of an import map */
  importMap?: URL | string;
  /** Specifiers of an import map. Takes precedence over `importMap`. */
  imports?: Record<string, string>;
  /** Override the default loading mechanism with a custom loader. This can
   * provide a way to use "in-memory" resources instead of fetching them
   * remotely. */
  load?: FetchCacher["load"];
  /** Should the emitted bundle be an ES module or an IIFE script. The default
   * is `"module"` to output a ESM module. */
  /** Import map scopes. Takes precedence over `importMap`. */
  scopes?: Record<string, Record<string, string>>;
  type?: "module" | "classic";
}

/** Options which can be set when using the {@linkcode transpile} function. */
export interface TranspileOptions {
  /** Allow remote modules to be loaded or read from the cache. */
  allowRemote?: boolean;
  /** Base URL to resolve import map specifiers. Defaults to `Deno.cwd()`.
   * Ignored if `imports` is not set. */
  baseUrl?: URL | string;
  /** The cache root to use, overriding the default inferred `DENO_DIR`. */
  cacheRoot?: string;
  /** The setting to use when loading sources from the Deno cache. */
  cacheSetting?: CacheSetting;
  /** Compiler options which can be set when transpiling. */
  compilerOptions?: CompilerOptions;
  /** Location of an import map */
  importMap?: URL | string;
  /** Specifiers of an import map. Takes precedence over `importMap`. */
  imports?: Record<string, string>;
  /** Override the default loading mechanism with a custom loader. This can
   * provide a way to use "in-memory" resources instead of fetching them
   * remotely. */
  load?: FetchCacher["load"];
  /** Import map scopes. Takes precedence over `importMap`. */
  scopes?: Record<string, Record<string, string>>;
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
export async function bundle(
  root: string | URL,
  options: BundleOptions = {},
): Promise<BundleEmit> {
  const {
    allowRemote,
    cacheRoot,
    cacheSetting,
    compilerOptions,
    load,
    type,
  } = options;

  checkCompilerOptions(compilerOptions);

  root = root instanceof URL ? root : toFileUrl(resolve(root));

  let bundleLoad = load;
  if (!bundleLoad) {
    const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
    bundleLoad = cache.load;
  }
  const importMap = await buildImportMap(options);
  const { bundle: jsBundle } = await instantiate();
  const result = await jsBundle(
    root.toString(),
    bundleLoad,
    type,
    importMap,
    compilerOptions,
  );
  return {
    code: result.code,
    map: result.maybe_map ?? undefined,
  };
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
export async function transpile(
  root: string | URL,
  options: TranspileOptions = {},
): Promise<Record<string, string>> {
  root = root instanceof URL ? root : toFileUrl(resolve(root));
  const { cacheSetting, cacheRoot, allowRemote, load, compilerOptions } =
    options;

  checkCompilerOptions(compilerOptions);

  let transpileLoad = load;
  if (!transpileLoad) {
    const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
    transpileLoad = cache.load;
  }
  const importMap = await buildImportMap(options);
  const { transpile: jsTranspile } = await instantiate();
  return jsTranspile(
    root.toString(),
    transpileLoad,
    importMap,
    compilerOptions,
  );
}

function checkCompilerOptions(
  compilerOptions: CompilerOptions | undefined,
): void {
  if (compilerOptions === undefined) {
    return;
  }
  if (compilerOptions.inlineSourceMap && compilerOptions.sourceMap) {
    throw new Error(
      "Option 'sourceMap' cannot be specified with option 'inlineSourceMap'",
    );
  }
  if (
    compilerOptions.inlineSources &&
    !(compilerOptions.inlineSourceMap || compilerOptions.sourceMap)
  ) {
    throw new Error(
      "Option 'inlineSources' can only be used when either option 'inlineSourceMap' or option 'sourceMap' is provided",
    );
  }
}

interface SerializedImportMap {
  url: string;
  value: string;
}

async function fetchImportMap(
  urlOrString: URL | string | undefined,
): Promise<SerializedImportMap | undefined> {
  if (!urlOrString) return undefined;
  const url = urlOrString instanceof URL
    ? urlOrString
    : toFileUrl(resolve(urlOrString));
  const fetchImportMapResponse = await fetch(url);
  const body = await fetchImportMapResponse.json();
  return {
    url: url.toString(),
    value: JSON.stringify({
      imports: body.imports,
      scopes: body.scopes,
    }),
  };
}

async function buildImportMap(
  options: {
    baseUrl?: URL | string;
    imports?: Record<string, string>;
    scopes?: Record<string, Record<string, string>>;
    importMap?: URL | string;
  },
): Promise<SerializedImportMap | undefined> {
  const { baseUrl, imports, scopes, importMap } = options;
  if (imports != null || scopes != null) {
    const url = baseUrl instanceof URL
      ? new URL(baseUrl.toString())
      : toFileUrl(baseUrl ? resolve(baseUrl) : Deno.cwd());
    // Rust lib expects url to be the file URL to the import map file, but the
    // JS API expects it to be the file URL to the root directory, so we need to
    // append an extra slash.
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return {
      url: url.toString(),
      value: JSON.stringify({ imports, scopes }),
    };
  }
  if (importMap != null) {
    const fetchedImportMap = await fetchImportMap(importMap);
    return fetchedImportMap;
  }
  return undefined;
}
