// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.

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

const encoder = new TextEncoder();

// run `deno task build` to build this
import { instantiate } from "./emit.generated.js";
import { locationToUrl } from "./_utils.ts";
import {
  type CacheSetting,
  createCache,
  type FetchCacher,
} from "https://deno.land/x/deno_cache@0.6.3/mod.ts";

/** The output of the {@linkcode bundle} function. */
export interface BundleEmit {
  /** The bundles code as a single JavaScript module. */
  code: string;
  /** An optional source map. */
  map?: string;
}

/** An [import-map](https://deno.land/manual/linking_to_external_code/import_maps#import-maps) */
export interface ImportMap {
  /** Base URL to resolve import map specifiers. It Is always treated as a
   * directory. Defaults to the file URL of `Deno.cwd()`. */
  baseUrl?: URL | string;
  /** Specifiers of the import map. */
  imports?: Record<string, string>;
  /** Overrides of the specifiers for the provided scopes. */
  scopes?: Record<string, Record<string, string>>;
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
  /** An [import-map](https://deno.land/manual/linking_to_external_code/import_maps#import-maps)
   * which will be applied to the imports, or the URL of an import map, or the
   * path to an import map */
  importMap?: ImportMap | URL | string;
  /** Override the default loading mechanism with a custom loader. This can
   * provide a way to use "in-memory" resources instead of fetching them
   * remotely. */
  load?: FetchCacher["load"];
  /** Minify compiled code, default false. */
  minify?: boolean;
  /** Should the emitted bundle be an ES module or an IIFE script. The default
   * is `"module"` to output a ESM module. */
  type?: "module" | "classic";
}

/** Options which can be set when using the {@linkcode transpile} function. */
export interface TranspileOptions {
  /** Allow remote modules to be loaded or read from the cache. */
  allowRemote?: boolean;
  /** The cache root to use, overriding the default inferred `DENO_DIR`. */
  cacheRoot?: string;
  /** The setting to use when loading sources from the Deno cache. */
  cacheSetting?: CacheSetting;
  /** Compiler options which can be set when transpiling. */
  compilerOptions?: CompilerOptions;
  /** An [import-map](https://deno.land/manual/linking_to_external_code/import_maps#import-maps)
   * which will be applied to the imports, or the URL of an import map, or the
   * path to an import map */
  importMap?: ImportMap | URL | string;
  /** Override the default loading mechanism with a custom loader. This can
   * provide a way to use "in-memory" resources instead of fetching them
   * remotely. */
  load?: FetchCacher["load"];
  //type?: "module" | "classic";
}

export interface CompilerOptions {
  checkJs?: boolean;
  /** Whether to use TypeScript's experimental decorators. */
  experimentalDecorators?: boolean;
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
  jsx?:
    | "precompile"
    | "preserve"
    | "react-jsx"
    | "react-jsxdev"
    | "react-native"
    | "react";
  /** Changes the function called in `.js` files when compiling JSX Elements
   * using the classic JSX runtime. The most common change is to use `"h"` or
   * `"preact.h"`. */
  jsxFactory?: string;
  /** Specify the JSX fragment factory function to use when targeting react JSX
   * emit with jsxFactory compiler option is specified, e.g. `Fragment`. */
  jsxFragmentFactory?: string;
  /** The string module specifier to implicitly import JSX factories from when
   * transpiling JSX. */
  jsxImportSource?: string;
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
    importMap,
    load,
    minify,
    type,
  } = options;

  checkCompilerOptions(compilerOptions);

  let bundleLoad = load;
  if (!bundleLoad) {
    const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
    bundleLoad = cache.load;
  }
  const { bundle: jsBundle } = await instantiate();
  const result = await jsBundle(
    locationToUrl(root).toString(),
    (specifier: string, isDynamic: boolean, cacheSetting: CacheSetting) => {
      return bundleLoad!(specifier, isDynamic, cacheSetting).then((result) => {
        if (result?.kind === "module") {
          if (typeof result.content === "string") {
            result.content = encoder.encode(result.content);
          }
          // need to convert to an array for serde_wasm_bindgen to work
          // deno-lint-ignore no-explicit-any
          (result as any).content = Array.from(result.content);
        }
        return result;
      });
    },
    type,
    processImportMapInput(importMap),
    compilerOptions,
    minify ?? false,
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
 * @returns A promise which resolves with a map of the emitted files,
 *          where the key is the emitted files name and the value is the
 *          source for the file.
 */
export async function transpile(
  root: string | URL,
  options: TranspileOptions = {},
): Promise<Map<string, string>> {
  const {
    allowRemote,
    cacheSetting,
    cacheRoot,
    compilerOptions,
    importMap,
    load,
  } = options;

  checkCompilerOptions(compilerOptions);

  let transpileLoad = load;
  if (!transpileLoad) {
    const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
    transpileLoad = cache.load;
  }
  const { transpile: jsTranspile } = await instantiate();
  return jsTranspile(
    locationToUrl(root).toString(),
    (specifier: string, isDynamic: boolean, cacheSetting: CacheSetting) => {
      return transpileLoad!(specifier, isDynamic, cacheSetting).then(
        (result) => {
          if (result?.kind === "module") {
            if (typeof result.content === "string") {
              result.content = encoder.encode(result.content);
            }
            // need to convert to an array for serde_wasm_bindgen to work
            // deno-lint-ignore no-explicit-any
            (result as any).content = Array.from(result.content);
          }
          return result;
        },
      );
    },
    processImportMapInput(importMap),
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

/**
 * Transforms the import map input to the format that The Rust lib expects ,
 * i.e. all locations are resolved to file URLs and the import map content is
 * serialized to JSON.
 * @param importMap The import map as provided to the JS API.
 * @returns The import map that must be provided to the Rust API.
 */
function processImportMapInput(
  importMap: ImportMapJsLibInput,
): ImportMapRustLibInput {
  if (typeof importMap === "string" || importMap instanceof URL) {
    return locationToUrl(importMap).toString();
  }
  if (typeof importMap === "object") {
    const { baseUrl, imports, scopes } = importMap;
    const url = locationToUrl(baseUrl ?? Deno.cwd());
    // Rust lib expects url to be the file URL to the import map file, but the
    // JS API expects it to be the file URL to the root directory, so we need to
    // append an extra slash.
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return {
      baseUrl: url.toString(),
      jsonString: JSON.stringify({ imports, scopes }),
    };
  }
  return undefined;
}

type ImportMapJsLibInput =
  | BundleOptions["importMap"]
  | TranspileOptions["importMap"];

type ImportMapRustLibInput =
  | {
    baseUrl: string;
    jsonString: string;
  }
  | string
  | undefined;
