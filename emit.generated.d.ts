// deno-lint-ignore-file
// deno-fmt-ignore-file

export interface InstantiateResult {
  instance: WebAssembly.Instance;
  exports: {
    bundle: typeof bundle;
    transpile: typeof transpile
  };
}

/** Gets if the Wasm module has been instantiated. */
export function isInstantiated(): boolean;

/** Options for instantiating a Wasm instance. */
export interface InstantiateOptions {
  /** Optional url to the Wasm file to instantiate. */
  url?: URL;
  /** Callback to decompress the raw Wasm file bytes before instantiating. */
  decompress?: (bytes: Uint8Array) => Uint8Array;
}

/** Instantiates an instance of the Wasm module returning its functions.
* @remarks It is safe to call this multiple times and once successfully
* loaded it will always return a reference to the same object. */
export function instantiate(opts?: InstantiateOptions): Promise<InstantiateResult["exports"]>;

/** Instantiates an instance of the Wasm module along with its exports.
 * @remarks It is safe to call this multiple times and once successfully
 * loaded it will always return a reference to the same object. */
export function instantiateWithInstance(opts?: InstantiateOptions): Promise<InstantiateResult>;

/**
* @param {string} root
* @param {Function} load
* @param {string | undefined} maybe_bundle_type
* @param {any} maybe_import_map
* @param {any} maybe_compiler_options
* @param {boolean} minify
* @returns {Promise<any>}
*/
export function bundle(root: string, load: Function, maybe_bundle_type: string | undefined, maybe_import_map: any, maybe_compiler_options: any, minify: boolean): Promise<any>;
/**
* @param {string} root
* @param {Function} load
* @param {any} maybe_import_map
* @param {any} maybe_compiler_options
* @returns {Promise<any>}
*/
export function transpile(root: string, load: Function, maybe_import_map: any, maybe_compiler_options: any): Promise<any>;
