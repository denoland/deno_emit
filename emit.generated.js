// @generated file from wasmbuild -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file
// source-hash: ed7baf2f39d025612631667516090e1b7afea216
let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) {
  return heap[idx];
}

function isLikeNone(x) {
  return x === undefined || x === null;
}

let cachedFloat64Memory0 = null;

function getFloat64Memory0() {
  if (cachedFloat64Memory0 === null || cachedFloat64Memory0.byteLength === 0) {
    cachedFloat64Memory0 = new Float64Array(wasm.memory.buffer);
  }
  return cachedFloat64Memory0;
}

let cachedInt32Memory0 = null;

function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}

let WASM_VECTOR_LEN = 0;

let cachedUint8Memory0 = null;

function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}

const cachedTextEncoder = typeof TextEncoder !== "undefined"
  ? new TextEncoder("utf-8")
  : {
    encode: () => {
      throw Error("TextEncoder not available");
    },
  };

const encodeString = function (arg, view) {
  return cachedTextEncoder.encodeInto(arg, view);
};

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;

  const mem = getUint8Memory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7F) break;
    mem[ptr + offset] = code;
  }

  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);

    offset += ret.written;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

let heap_next = heap.length;

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];

  heap[idx] = obj;
  return idx;
}

const cachedTextDecoder = typeof TextDecoder !== "undefined"
  ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true })
  : {
    decode: () => {
      throw Error("TextDecoder not available");
    },
  };

if (typeof TextDecoder !== "undefined") cachedTextDecoder.decode();

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function dropObject(idx) {
  if (idx < 132) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

let cachedBigInt64Memory0 = null;

function getBigInt64Memory0() {
  if (
    cachedBigInt64Memory0 === null || cachedBigInt64Memory0.byteLength === 0
  ) {
    cachedBigInt64Memory0 = new BigInt64Array(wasm.memory.buffer);
  }
  return cachedBigInt64Memory0;
}

function debugString(val) {
  // primitive types
  const type = typeof val;
  if (type == "number" || type == "boolean" || val == null) {
    return `${val}`;
  }
  if (type == "string") {
    return `"${val}"`;
  }
  if (type == "symbol") {
    const description = val.description;
    if (description == null) {
      return "Symbol";
    } else {
      return `Symbol(${description})`;
    }
  }
  if (type == "function") {
    const name = val.name;
    if (typeof name == "string" && name.length > 0) {
      return `Function(${name})`;
    } else {
      return "Function";
    }
  }
  // objects
  if (Array.isArray(val)) {
    const length = val.length;
    let debug = "[";
    if (length > 0) {
      debug += debugString(val[0]);
    }
    for (let i = 1; i < length; i++) {
      debug += ", " + debugString(val[i]);
    }
    debug += "]";
    return debug;
  }
  // Test for built-in
  const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
  let className;
  if (builtInMatches.length > 1) {
    className = builtInMatches[1];
  } else {
    // Failed to match the standard '[object ClassName]'
    return toString.call(val);
  }
  if (className == "Object") {
    // we're a user defined class or Object
    // JSON.stringify avoids problems with cycles, and is generally much
    // easier than looping through ownProperties of `val`.
    try {
      return "Object(" + JSON.stringify(val) + ")";
    } catch (_) {
      return "Object";
    }
  }
  // errors
  if (val instanceof Error) {
    return `${val.name}: ${val.message}\n${val.stack}`;
  }
  // TODO we could test for more things here, like `Set`s and `Map`s.
  return className;
}

const CLOSURE_DTORS = new FinalizationRegistry((state) => {
  wasm.__wbindgen_export_2.get(state.dtor)(state.a, state.b);
});

function makeMutClosure(arg0, arg1, dtor, f) {
  const state = { a: arg0, b: arg1, cnt: 1, dtor };
  const real = (...args) => {
    // First up with a closure we increment the internal reference
    // count. This ensures that the Rust closure environment won't
    // be deallocated while we're invoking it.
    state.cnt++;
    const a = state.a;
    state.a = 0;
    try {
      return f(a, state.b, ...args);
    } finally {
      if (--state.cnt === 0) {
        wasm.__wbindgen_export_2.get(state.dtor)(a, state.b);
        CLOSURE_DTORS.unregister(state);
      } else {
        state.a = a;
      }
    }
  };
  real.original = state;
  CLOSURE_DTORS.register(real, state, state);
  return real;
}
function __wbg_adapter_46(arg0, arg1, arg2) {
  wasm.wasm_bindgen__convert__closures__invoke1_mut__hc58e34bcdc76d66f(
    arg0,
    arg1,
    addHeapObject(arg2),
  );
}

/**
 * @param {string} root
 * @param {Function} load
 * @param {string | undefined} maybe_bundle_type
 * @param {any} maybe_import_map
 * @param {any} maybe_compiler_options
 * @param {boolean} minify
 * @returns {Promise<any>}
 */
export function bundle(
  root,
  load,
  maybe_bundle_type,
  maybe_import_map,
  maybe_compiler_options,
  minify,
) {
  const ptr0 = passStringToWasm0(
    root,
    wasm.__wbindgen_malloc,
    wasm.__wbindgen_realloc,
  );
  const len0 = WASM_VECTOR_LEN;
  var ptr1 = isLikeNone(maybe_bundle_type)
    ? 0
    : passStringToWasm0(
      maybe_bundle_type,
      wasm.__wbindgen_malloc,
      wasm.__wbindgen_realloc,
    );
  var len1 = WASM_VECTOR_LEN;
  const ret = wasm.bundle(
    ptr0,
    len0,
    addHeapObject(load),
    ptr1,
    len1,
    addHeapObject(maybe_import_map),
    addHeapObject(maybe_compiler_options),
    minify,
  );
  return takeObject(ret);
}

/**
 * @param {string} root
 * @param {Function} load
 * @param {any} maybe_import_map
 * @param {any} maybe_compiler_options
 * @returns {Promise<any>}
 */
export function transpile(
  root,
  load,
  maybe_import_map,
  maybe_compiler_options,
) {
  const ptr0 = passStringToWasm0(
    root,
    wasm.__wbindgen_malloc,
    wasm.__wbindgen_realloc,
  );
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.transpile(
    ptr0,
    len0,
    addHeapObject(load),
    addHeapObject(maybe_import_map),
    addHeapObject(maybe_compiler_options),
  );
  return takeObject(ret);
}

function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
function __wbg_adapter_101(arg0, arg1, arg2, arg3) {
  wasm.wasm_bindgen__convert__closures__invoke2_mut__h07fb59b8f44697a0(
    arg0,
    arg1,
    addHeapObject(arg2),
    addHeapObject(arg3),
  );
}

const imports = {
  __wbindgen_placeholder__: {
    __wbindgen_in: function (arg0, arg1) {
      const ret = getObject(arg0) in getObject(arg1);
      return ret;
    },
    __wbindgen_number_get: function (arg0, arg1) {
      const obj = getObject(arg1);
      const ret = typeof obj === "number" ? obj : undefined;
      getFloat64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? 0 : ret;
      getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
    },
    __wbindgen_boolean_get: function (arg0) {
      const v = getObject(arg0);
      const ret = typeof v === "boolean" ? (v ? 1 : 0) : 2;
      return ret;
    },
    __wbindgen_string_get: function (arg0, arg1) {
      const obj = getObject(arg1);
      const ret = typeof obj === "string" ? obj : undefined;
      var ptr1 = isLikeNone(ret)
        ? 0
        : passStringToWasm0(
          ret,
          wasm.__wbindgen_malloc,
          wasm.__wbindgen_realloc,
        );
      var len1 = WASM_VECTOR_LEN;
      getInt32Memory0()[arg0 / 4 + 1] = len1;
      getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    },
    __wbindgen_is_bigint: function (arg0) {
      const ret = typeof (getObject(arg0)) === "bigint";
      return ret;
    },
    __wbindgen_is_object: function (arg0) {
      const val = getObject(arg0);
      const ret = typeof val === "object" && val !== null;
      return ret;
    },
    __wbindgen_bigint_from_i64: function (arg0) {
      const ret = arg0;
      return addHeapObject(ret);
    },
    __wbindgen_bigint_from_u64: function (arg0) {
      const ret = BigInt.asUintN(64, arg0);
      return addHeapObject(ret);
    },
    __wbindgen_error_new: function (arg0, arg1) {
      const ret = new Error(getStringFromWasm0(arg0, arg1));
      return addHeapObject(ret);
    },
    __wbindgen_jsval_eq: function (arg0, arg1) {
      const ret = getObject(arg0) === getObject(arg1);
      return ret;
    },
    __wbindgen_object_drop_ref: function (arg0) {
      takeObject(arg0);
    },
    __wbindgen_is_undefined: function (arg0) {
      const ret = getObject(arg0) === undefined;
      return ret;
    },
    __wbindgen_string_new: function (arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return addHeapObject(ret);
    },
    __wbg_new_abda76e883ba8a5f: function () {
      const ret = new Error();
      return addHeapObject(ret);
    },
    __wbg_stack_658279fe44541cf6: function (arg0, arg1) {
      const ret = getObject(arg1).stack;
      const ptr1 = passStringToWasm0(
        ret,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len1 = WASM_VECTOR_LEN;
      getInt32Memory0()[arg0 / 4 + 1] = len1;
      getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    },
    __wbg_error_f851667af71bcfc6: function (arg0, arg1) {
      let deferred0_0;
      let deferred0_1;
      try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
      } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
      }
    },
    __wbindgen_cb_drop: function (arg0) {
      const obj = takeObject(arg0).original;
      if (obj.cnt-- == 1) {
        obj.a = 0;
        return true;
      }
      const ret = false;
      return ret;
    },
    __wbindgen_object_clone_ref: function (arg0) {
      const ret = getObject(arg0);
      return addHeapObject(ret);
    },
    __wbindgen_jsval_loose_eq: function (arg0, arg1) {
      const ret = getObject(arg0) == getObject(arg1);
      return ret;
    },
    __wbg_String_88810dfeb4021902: function (arg0, arg1) {
      const ret = String(getObject(arg1));
      const ptr1 = passStringToWasm0(
        ret,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len1 = WASM_VECTOR_LEN;
      getInt32Memory0()[arg0 / 4 + 1] = len1;
      getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    },
    __wbg_getwithrefkey_5e6d9547403deab8: function (arg0, arg1) {
      const ret = getObject(arg0)[getObject(arg1)];
      return addHeapObject(ret);
    },
    __wbg_set_841ac57cff3d672b: function (arg0, arg1, arg2) {
      getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
    },
    __wbindgen_is_string: function (arg0) {
      const ret = typeof (getObject(arg0)) === "string";
      return ret;
    },
    __wbindgen_is_function: function (arg0) {
      const ret = typeof (getObject(arg0)) === "function";
      return ret;
    },
    __wbg_length_fff51ee6522a1a18: function (arg0) {
      const ret = getObject(arg0).length;
      return ret;
    },
    __wbg_new_56693dbed0c32988: function () {
      const ret = new Map();
      return addHeapObject(ret);
    },
    __wbg_next_526fc47e980da008: function (arg0) {
      const ret = getObject(arg0).next;
      return addHeapObject(ret);
    },
    __wbg_value_1695675138684bd5: function (arg0) {
      const ret = getObject(arg0).value;
      return addHeapObject(ret);
    },
    __wbg_iterator_97f0c81209c6c35a: function () {
      const ret = Symbol.iterator;
      return addHeapObject(ret);
    },
    __wbg_new_b51585de1b234aff: function () {
      const ret = new Object();
      return addHeapObject(ret);
    },
    __wbg_get_44be0491f933a435: function (arg0, arg1) {
      const ret = getObject(arg0)[arg1 >>> 0];
      return addHeapObject(ret);
    },
    __wbg_isArray_4c24b343cb13cfb1: function (arg0) {
      const ret = Array.isArray(getObject(arg0));
      return ret;
    },
    __wbg_instanceof_ArrayBuffer_39ac22089b74fddb: function (arg0) {
      let result;
      try {
        result = getObject(arg0) instanceof ArrayBuffer;
      } catch {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_new_d258248ed531ff54: function (arg0, arg1) {
      const ret = new Error(getStringFromWasm0(arg0, arg1));
      return addHeapObject(ret);
    },
    __wbg_call_cb65541d95d71282: function () {
      return handleError(function (arg0, arg1) {
        const ret = getObject(arg0).call(getObject(arg1));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_call_01734de55d61e11d: function () {
      return handleError(function (arg0, arg1, arg2) {
        const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_call_4c92f6aec1e1d6e6: function () {
      return handleError(function (arg0, arg1, arg2, arg3) {
        const ret = getObject(arg0).call(
          getObject(arg1),
          getObject(arg2),
          getObject(arg3),
        );
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_set_bedc3d02d0f05eb0: function (arg0, arg1, arg2) {
      const ret = getObject(arg0).set(getObject(arg1), getObject(arg2));
      return addHeapObject(ret);
    },
    __wbg_next_ddb3312ca1c4e32a: function () {
      return handleError(function (arg0) {
        const ret = getObject(arg0).next();
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_done_5c1f01fb660d73b5: function (arg0) {
      const ret = getObject(arg0).done;
      return ret;
    },
    __wbg_isSafeInteger_bb8e18dd21c97288: function (arg0) {
      const ret = Number.isSafeInteger(getObject(arg0));
      return ret;
    },
    __wbg_entries_e51f29c7bba0c054: function (arg0) {
      const ret = Object.entries(getObject(arg0));
      return addHeapObject(ret);
    },
    __wbg_get_97b561fb56f034b5: function () {
      return handleError(function (arg0, arg1) {
        const ret = Reflect.get(getObject(arg0), getObject(arg1));
        return addHeapObject(ret);
      }, arguments);
    },
    __wbg_buffer_085ec1f694018c4f: function (arg0) {
      const ret = getObject(arg0).buffer;
      return addHeapObject(ret);
    },
    __wbg_new_43f1b47c28813cbd: function (arg0, arg1) {
      try {
        var state0 = { a: arg0, b: arg1 };
        var cb0 = (arg0, arg1) => {
          const a = state0.a;
          state0.a = 0;
          try {
            return __wbg_adapter_101(a, state0.b, arg0, arg1);
          } finally {
            state0.a = a;
          }
        };
        const ret = new Promise(cb0);
        return addHeapObject(ret);
      } finally {
        state0.a = state0.b = 0;
      }
    },
    __wbg_resolve_53698b95aaf7fcf8: function (arg0) {
      const ret = Promise.resolve(getObject(arg0));
      return addHeapObject(ret);
    },
    __wbg_then_f7e06ee3c11698eb: function (arg0, arg1) {
      const ret = getObject(arg0).then(getObject(arg1));
      return addHeapObject(ret);
    },
    __wbg_then_b2267541e2a73865: function (arg0, arg1, arg2) {
      const ret = getObject(arg0).then(getObject(arg1), getObject(arg2));
      return addHeapObject(ret);
    },
    __wbg_new_8125e318e6245eed: function (arg0) {
      const ret = new Uint8Array(getObject(arg0));
      return addHeapObject(ret);
    },
    __wbg_instanceof_Uint8Array_d8d9cb2b8e8ac1d4: function (arg0) {
      let result;
      try {
        result = getObject(arg0) instanceof Uint8Array;
      } catch {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_length_72e2208bbc0efc61: function (arg0) {
      const ret = getObject(arg0).length;
      return ret;
    },
    __wbg_set_5cf90238115182c3: function (arg0, arg1, arg2) {
      getObject(arg0).set(getObject(arg1), arg2 >>> 0);
    },
    __wbindgen_bigint_get_as_i64: function (arg0, arg1) {
      const v = getObject(arg1);
      const ret = typeof v === "bigint" ? v : undefined;
      getBigInt64Memory0()[arg0 / 8 + 1] = isLikeNone(ret) ? BigInt(0) : ret;
      getInt32Memory0()[arg0 / 4 + 0] = !isLikeNone(ret);
    },
    __wbindgen_debug_string: function (arg0, arg1) {
      const ret = debugString(getObject(arg1));
      const ptr1 = passStringToWasm0(
        ret,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len1 = WASM_VECTOR_LEN;
      getInt32Memory0()[arg0 / 4 + 1] = len1;
      getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    },
    __wbindgen_throw: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbindgen_memory: function () {
      const ret = wasm.memory;
      return addHeapObject(ret);
    },
    __wbindgen_closure_wrapper609: function (arg0, arg1, arg2) {
      const ret = makeMutClosure(arg0, arg1, 189, __wbg_adapter_46);
      return addHeapObject(ret);
    },
  },
};

import { Loader } from "https://deno.land/x/wasmbuild@0.15.1/loader.ts";
import { cacheToLocalDir } from "https://deno.land/x/wasmbuild@0.15.1/cache.ts";

const loader = new Loader({
  imports,
  cache: cacheToLocalDir,
});
/**
 * Decompression callback
 *
 * @callback DecompressCallback
 * @param {Uint8Array} compressed
 * @return {Uint8Array} decompressed
 */

/**
 * Options for instantiating a Wasm instance.
 * @typedef {Object} InstantiateOptions
 * @property {URL=} url - Optional url to the Wasm file to instantiate.
 * @property {DecompressCallback=} decompress - Callback to decompress the
 * raw Wasm file bytes before instantiating.
 */

/** Instantiates an instance of the Wasm module returning its functions.
 * @remarks It is safe to call this multiple times and once successfully
 * loaded it will always return a reference to the same object.
 * @param {InstantiateOptions=} opts
 */
export async function instantiate(opts) {
  return (await instantiateWithInstance(opts)).exports;
}

/** Instantiates an instance of the Wasm module along with its exports.
 * @remarks It is safe to call this multiple times and once successfully
 * loaded it will always return a reference to the same object.
 * @param {InstantiateOptions=} opts
 * @returns {Promise<{
 *   instance: WebAssembly.Instance;
 *   exports: { bundle: typeof bundle; transpile: typeof transpile }
 * }>}
 */
export async function instantiateWithInstance(opts) {
  const { instance } = await loader.load(
    opts?.url ?? new URL("emit_bg.wasm", import.meta.url),
    opts?.decompress,
  );
  wasm = wasm ?? instance.exports;
  cachedInt32Memory0 = cachedInt32Memory0 ?? new Int32Array(wasm.memory.buffer);
  cachedUint8Memory0 = cachedUint8Memory0 ?? new Uint8Array(wasm.memory.buffer);
  return {
    instance,
    exports: getWasmInstanceExports(),
  };
}

function getWasmInstanceExports() {
  return { bundle, transpile };
}

/** Gets if the Wasm module has been instantiated. */
export function isInstantiated() {
  return loader.instance != null;
}
