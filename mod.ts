// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

import {
  bundle as jsBundle,
  transpile,
} from "./lib/deno_emit.generated.js";

import type { CacheSetting } from "https://deno.land/x/deno_cache@0.2.0/file_fetcher.ts";

export interface BundleEmit {
  code: string;
  map?: string;
}

export interface LoadResponse {
  /** The string URL of the resource. If there were redirects, the final
   * specifier should be set here, otherwise the requested specifier. */
  specifier: string;
  /** For remote resources, a record of headers should be set, where the key's
   * have been normalized to be lower case values. */
  headers?: Record<string, string>;
  /** The string value of the loaded resources. */
  content: string;
}

export interface BundleOptions {
  allowRemote?: boolean;
  cacheRoot?: string;
  cacheSetting?: CacheSetting;
  compilerOptions?: CompilerOptions;
  imports: Record<string, string[]>;
  load?(
    specifier: string,
    isDynamic: boolean,
  ): Promise<LoadResponse | undefined>;
  type?: "module" | "classic";
}

export interface EmitOptions {
  allowRemote?: boolean;
  cacheRoot?: string;
  cacheSetting?: CacheSetting;
  //compilerOptions?: CompilerOptions;
  //imports: Record<string, string[]>;
  // load?( specifier: string, isDynamic: boolean,): Promise<LoadResponse | undefined>;
  //type?: "module" | "classic";
}

export interface CompilerOptions {
  checkJs?: boolean;
  emitDecoratorMetadata?: boolean;
  importsNotUsedAsValues?: string;
  inlineSourceMap?: boolean;
  inlineSources?: boolean;
  jsx?: "jsx" | "preserve";
  jsxFactory?: string;
  jsxFragmentFactory?: string;
  sourceMap?: boolean;
}

export async function bundle(
  root: string,
  options: BundleOptions = {},
): Promise<BundleEmit> {
  const {
    type = "module",
    imports,
    load,
    cacheSetting,
    cacheRoot,
    allowRemote,
    compilerOptions,
  } = options;
  let bundleLoad = load;
  if (!bundleLoad) {
    const { createCache } = await import(
      "https://deno.land/x/deno_cache@0.2.0/mod.ts"
    );
    const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
    // FIXME(bartlomieju): this "kind" field in here is quirky
    bundleLoad = async (arg1, arg2) => {
      const r = await cache.load(arg1, arg2);
      return { ...r, kind: "module" };
    };
  }
  return jsBundle(root, bundleLoad, imports, undefined);
}

export async function emit(root: string, options: EmitOptions = {}): Promise<void> {
  const {
    cacheSetting,
    cacheRoot,
    allowRemote,
  } = options;

  const { createCache } = await import( "https://deno.land/x/deno_cache@0.2.0/mod.ts");
  const cache = createCache({ root: cacheRoot, cacheSetting, allowRemote });
  // FIXME(bartlomieju): this "kind" field in here is quirky
  const emitLoad = async (arg1, arg2) => {
    const r = await cache.load(arg1, arg2);
    return { ...r, kind: "module" };
  };

  return transpile(root, emitLoad, undefined);
}
