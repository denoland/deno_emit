// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Buffer } from "../io/buffer.ts";
const DEFAULT_CHUNK_SIZE = 16_640;
const DEFAULT_BUFFER_SIZE = 32 * 1024;
function isCloser(value) {
    return typeof value === "object" && value != null && "close" in value && // deno-lint-ignore no-explicit-any
    typeof value["close"] === "function";
}
/** Create a `Deno.Reader` from an iterable of `Uint8Array`s.
 *
 * ```ts
 *      import { readerFromIterable } from "./conversion.ts";
 *
 *      const file = await Deno.open("metrics.txt", { write: true });
 *      const reader = readerFromIterable((async function* () {
 *        while (true) {
 *          await new Promise((r) => setTimeout(r, 1000));
 *          const message = `data: ${JSON.stringify(Deno.metrics())}\n\n`;
 *          yield new TextEncoder().encode(message);
 *        }
 *      })());
 *      await Deno.copy(reader, file);
 * ```
 */ export function readerFromIterable(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.();
    const buffer = new Buffer();
    return {
        async read (p) {
            if (buffer.length == 0) {
                const result = await iterator.next();
                if (result.done) {
                    return null;
                } else {
                    if (result.value.byteLength <= p.byteLength) {
                        p.set(result.value);
                        return result.value.byteLength;
                    }
                    p.set(result.value.subarray(0, p.byteLength));
                    await writeAll(buffer, result.value.subarray(p.byteLength));
                    return p.byteLength;
                }
            } else {
                const n = await buffer.read(p);
                if (n == null) {
                    return this.read(p);
                }
                return n;
            }
        }
    };
}
/** Create a `Writer` from a `WritableStreamDefaultWriter`. */ export function writerFromStreamWriter(streamWriter) {
    return {
        async write (p) {
            await streamWriter.ready;
            await streamWriter.write(p);
            return p.length;
        }
    };
}
/** Create a `Reader` from a `ReadableStreamDefaultReader`. */ export function readerFromStreamReader(streamReader) {
    const buffer = new Buffer();
    return {
        async read (p) {
            if (buffer.empty()) {
                const res = await streamReader.read();
                if (res.done) {
                    return null; // EOF
                }
                await writeAll(buffer, res.value);
            }
            return buffer.read(p);
        }
    };
}
/** Create a `WritableStream` from a `Writer`. */ export function writableStreamFromWriter(writer, options = {}) {
    const { autoClose =true  } = options;
    return new WritableStream({
        async write (chunk, controller) {
            try {
                await writeAll(writer, chunk);
            } catch (e) {
                controller.error(e);
                if (isCloser(writer) && autoClose) {
                    writer.close();
                }
            }
        },
        close () {
            if (isCloser(writer) && autoClose) {
                writer.close();
            }
        },
        abort () {
            if (isCloser(writer) && autoClose) {
                writer.close();
            }
        }
    });
}
/** Create a `ReadableStream` from any kind of iterable.
 *
 * ```ts
 *      import { readableStreamFromIterable } from "./conversion.ts";
 *
 *      const r1 = readableStreamFromIterable(["foo, bar, baz"]);
 *      const r2 = readableStreamFromIterable(async function* () {
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "foo";
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "bar";
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "baz";
 *      }());
 * ```
 *
 * If the produced iterator (`iterable[Symbol.asyncIterator]()` or
 * `iterable[Symbol.iterator]()`) is a generator, or more specifically is found
 * to have a `.throw()` method on it, that will be called upon
 * `readableStream.cancel()`. This is the case for the second input type above:
 *
 * ```ts
 * import { readableStreamFromIterable } from "./conversion.ts";
 *
 * const r3 = readableStreamFromIterable(async function* () {
 *   try {
 *     yield "foo";
 *   } catch (error) {
 *     console.log(error); // Error: Cancelled by consumer.
 *   }
 * }());
 * const reader = r3.getReader();
 * console.log(await reader.read()); // { value: "foo", done: false }
 * await reader.cancel(new Error("Cancelled by consumer."));
 * ```
 */ export function readableStreamFromIterable(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.();
    return new ReadableStream({
        async pull (controller) {
            const { value , done  } = await iterator.next();
            if (done) {
                controller.close();
            } else {
                controller.enqueue(value);
            }
        },
        async cancel (reason) {
            if (typeof iterator.throw == "function") {
                try {
                    await iterator.throw(reason);
                } catch  {}
            }
        }
    });
}
/**
 * Create a `ReadableStream<Uint8Array>` from from a `Deno.Reader`.
 *
 * When the pull algorithm is called on the stream, a chunk from the reader
 * will be read.  When `null` is returned from the reader, the stream will be
 * closed along with the reader (if it is also a `Deno.Closer`).
 *
 * An example converting a `Deno.FsFile` into a readable stream:
 *
 * ```ts
 * import { readableStreamFromReader } from "./mod.ts";
 *
 * const file = await Deno.open("./file.txt", { read: true });
 * const fileStream = readableStreamFromReader(file);
 * ```
 */ export function readableStreamFromReader(reader, options = {}) {
    const { autoClose =true , chunkSize =DEFAULT_CHUNK_SIZE , strategy  } = options;
    return new ReadableStream({
        async pull (controller) {
            const chunk = new Uint8Array(chunkSize);
            try {
                const read = await reader.read(chunk);
                if (read === null) {
                    if (isCloser(reader) && autoClose) {
                        reader.close();
                    }
                    controller.close();
                    return;
                }
                controller.enqueue(chunk.subarray(0, read));
            } catch (e) {
                controller.error(e);
                if (isCloser(reader)) {
                    reader.close();
                }
            }
        },
        cancel () {
            if (isCloser(reader) && autoClose) {
                reader.close();
            }
        }
    }, strategy);
}
/** Read Reader `r` until EOF (`null`) and resolve to the content as
 * Uint8Array`.
 *
 * ```ts
 * import { Buffer } from "../io/buffer.ts";
 * import { readAll } from "./conversion.ts";
 *
 * // Example from stdin
 * const stdinContent = await readAll(Deno.stdin);
 *
 * // Example from file
 * const file = await Deno.open("my_file.txt", {read: true});
 * const myFileContent = await readAll(file);
 * Deno.close(file.rid);
 *
 * // Example from buffer
 * const myData = new Uint8Array(100);
 * // ... fill myData array with data
 * const reader = new Buffer(myData.buffer);
 * const bufferContent = await readAll(reader);
 * ```
 */ export async function readAll(r) {
    const buf = new Buffer();
    await buf.readFrom(r);
    return buf.bytes();
}
/** Synchronously reads Reader `r` until EOF (`null`) and returns the content
 * as `Uint8Array`.
 *
 * ```ts
 * import { Buffer } from "../io/buffer.ts";
 * import { readAllSync } from "./conversion.ts";
 *
 * // Example from stdin
 * const stdinContent = readAllSync(Deno.stdin);
 *
 * // Example from file
 * const file = Deno.openSync("my_file.txt", {read: true});
 * const myFileContent = readAllSync(file);
 * Deno.close(file.rid);
 *
 * // Example from buffer
 * const myData = new Uint8Array(100);
 * // ... fill myData array with data
 * const reader = new Buffer(myData.buffer);
 * const bufferContent = readAllSync(reader);
 * ```
 */ export function readAllSync(r) {
    const buf = new Buffer();
    buf.readFromSync(r);
    return buf.bytes();
}
/** Write all the content of the array buffer (`arr`) to the writer (`w`).
 *
 * ```ts
 * import { Buffer } from "../io/buffer.ts";
 * import { writeAll } from "./conversion.ts";

 * // Example writing to stdout
 * let contentBytes = new TextEncoder().encode("Hello World");
 * await writeAll(Deno.stdout, contentBytes);
 *
 * // Example writing to file
 * contentBytes = new TextEncoder().encode("Hello World");
 * const file = await Deno.open('test.file', {write: true});
 * await writeAll(file, contentBytes);
 * Deno.close(file.rid);
 *
 * // Example writing to buffer
 * contentBytes = new TextEncoder().encode("Hello World");
 * const writer = new Buffer();
 * await writeAll(writer, contentBytes);
 * console.log(writer.bytes().length);  // 11
 * ```
 */ export async function writeAll(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += await w.write(arr.subarray(nwritten));
    }
}
/** Synchronously write all the content of the array buffer (`arr`) to the
 * writer (`w`).
 *
 * ```ts
 * import { Buffer } from "../io/buffer.ts";
 * import { writeAllSync } from "./conversion.ts";
 *
 * // Example writing to stdout
 * let contentBytes = new TextEncoder().encode("Hello World");
 * writeAllSync(Deno.stdout, contentBytes);
 *
 * // Example writing to file
 * contentBytes = new TextEncoder().encode("Hello World");
 * const file = Deno.openSync('test.file', {write: true});
 * writeAllSync(file, contentBytes);
 * Deno.close(file.rid);
 *
 * // Example writing to buffer
 * contentBytes = new TextEncoder().encode("Hello World");
 * const writer = new Buffer();
 * writeAllSync(writer, contentBytes);
 * console.log(writer.bytes().length);  // 11
 * ```
 */ export function writeAllSync(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += w.writeSync(arr.subarray(nwritten));
    }
}
/** Turns a Reader, `r`, into an async iterator.
 *
 * ```ts
 * import { iterateReader } from "./conversion.ts";
 *
 * let f = await Deno.open("/etc/passwd");
 * for await (const chunk of iterateReader(f)) {
 *   console.log(chunk);
 * }
 * f.close();
 * ```
 *
 * Second argument can be used to tune size of a buffer.
 * Default size of the buffer is 32kB.
 *
 * ```ts
 * import { iterateReader } from "./conversion.ts";
 *
 * let f = await Deno.open("/etc/passwd");
 * const it = iterateReader(f, {
 *   bufSize: 1024 * 1024
 * });
 * for await (const chunk of it) {
 *   console.log(chunk);
 * }
 * f.close();
 * ```
 *
 * Iterator uses an internal buffer of fixed size for efficiency; it returns
 * a view on that buffer on each iteration. It is therefore caller's
 * responsibility to copy contents of the buffer if needed; otherwise the
 * next iteration will overwrite contents of previously returned chunk.
 */ export async function* iterateReader(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    while(true){
        const result = await r.read(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
/** Turns a ReaderSync, `r`, into an iterator.
 *
 * ```ts
 * import { iterateReaderSync } from "./conversion.ts";
 *
 * let f = Deno.openSync("/etc/passwd");
 * for (const chunk of iterateReaderSync(f)) {
 *   console.log(chunk);
 * }
 * f.close();
 * ```
 *
 * Second argument can be used to tune size of a buffer.
 * Default size of the buffer is 32kB.
 *
 * ```ts
 * import { iterateReaderSync } from "./conversion.ts";

 * let f = await Deno.open("/etc/passwd");
 * const iter = iterateReaderSync(f, {
 *   bufSize: 1024 * 1024
 * });
 * for (const chunk of iter) {
 *   console.log(chunk);
 * }
 * f.close();
 * ```
 *
 * Iterator uses an internal buffer of fixed size for efficiency; it returns
 * a view on that buffer on each iteration. It is therefore caller's
 * responsibility to copy contents of the buffer if needed; otherwise the
 * next iteration will overwrite contents of previously returned chunk.
 */ export function* iterateReaderSync(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    while(true){
        const result = r.readSync(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
/** Copies from `src` to `dst` until either EOF (`null`) is read from `src` or
 * an error occurs. It resolves to the number of bytes copied or rejects with
 * the first error encountered while copying.
 *
 * ```ts
 * import { copy } from "./conversion.ts";
 *
 * const source = await Deno.open("my_file.txt");
 * const bytesCopied1 = await copy(source, Deno.stdout);
 * const destination = await Deno.create("my_file_2.txt");
 * const bytesCopied2 = await copy(source, destination);
 * ```
 *
 * @param src The source to copy from
 * @param dst The destination to copy to
 * @param options Can be used to tune size of the buffer. Default size is 32kB
 */ export async function copy(src, dst, options) {
    let n = 0;
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    let gotEOF = false;
    while(gotEOF === false){
        const result = await src.read(b);
        if (result === null) {
            gotEOF = true;
        } else {
            let nwritten = 0;
            while(nwritten < result){
                nwritten += await dst.write(b.subarray(nwritten, result));
            }
            n += nwritten;
        }
    }
    return n;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL3N0cmVhbXMvY29udmVyc2lvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vaW8vYnVmZmVyLnRzXCI7XG5cbmNvbnN0IERFRkFVTFRfQ0hVTktfU0laRSA9IDE2XzY0MDtcbmNvbnN0IERFRkFVTFRfQlVGRkVSX1NJWkUgPSAzMiAqIDEwMjQ7XG5cbmZ1bmN0aW9uIGlzQ2xvc2VyKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgRGVuby5DbG9zZXIge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9IG51bGwgJiYgXCJjbG9zZVwiIGluIHZhbHVlICYmXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICB0eXBlb2YgKHZhbHVlIGFzIFJlY29yZDxzdHJpbmcsIGFueT4pW1wiY2xvc2VcIl0gPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuLyoqIENyZWF0ZSBhIGBEZW5vLlJlYWRlcmAgZnJvbSBhbiBpdGVyYWJsZSBvZiBgVWludDhBcnJheWBzLlxuICpcbiAqIGBgYHRzXG4gKiAgICAgIGltcG9ydCB7IHJlYWRlckZyb21JdGVyYWJsZSB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCBEZW5vLm9wZW4oXCJtZXRyaWNzLnR4dFwiLCB7IHdyaXRlOiB0cnVlIH0pO1xuICogICAgICBjb25zdCByZWFkZXIgPSByZWFkZXJGcm9tSXRlcmFibGUoKGFzeW5jIGZ1bmN0aW9uKiAoKSB7XG4gKiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAqICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDApKTtcbiAqICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgZGF0YTogJHtKU09OLnN0cmluZ2lmeShEZW5vLm1ldHJpY3MoKSl9XFxuXFxuYDtcbiAqICAgICAgICAgIHlpZWxkIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShtZXNzYWdlKTtcbiAqICAgICAgICB9XG4gKiAgICAgIH0pKCkpO1xuICogICAgICBhd2FpdCBEZW5vLmNvcHkocmVhZGVyLCBmaWxlKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGVyRnJvbUl0ZXJhYmxlKFxuICBpdGVyYWJsZTogSXRlcmFibGU8VWludDhBcnJheT4gfCBBc3luY0l0ZXJhYmxlPFVpbnQ4QXJyYXk+LFxuKTogRGVuby5SZWFkZXIge1xuICBjb25zdCBpdGVyYXRvcjogSXRlcmF0b3I8VWludDhBcnJheT4gfCBBc3luY0l0ZXJhdG9yPFVpbnQ4QXJyYXk+ID1cbiAgICAoaXRlcmFibGUgYXMgQXN5bmNJdGVyYWJsZTxVaW50OEFycmF5PilbU3ltYm9sLmFzeW5jSXRlcmF0b3JdPy4oKSA/P1xuICAgICAgKGl0ZXJhYmxlIGFzIEl0ZXJhYmxlPFVpbnQ4QXJyYXk+KVtTeW1ib2wuaXRlcmF0b3JdPy4oKTtcbiAgY29uc3QgYnVmZmVyID0gbmV3IEJ1ZmZlcigpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jIHJlYWQocDogVWludDhBcnJheSk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgICAgaWYgKGJ1ZmZlci5sZW5ndGggPT0gMCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIGlmIChyZXN1bHQuZG9uZSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChyZXN1bHQudmFsdWUuYnl0ZUxlbmd0aCA8PSBwLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgIHAuc2V0KHJlc3VsdC52YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnZhbHVlLmJ5dGVMZW5ndGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIHAuc2V0KHJlc3VsdC52YWx1ZS5zdWJhcnJheSgwLCBwLmJ5dGVMZW5ndGgpKTtcbiAgICAgICAgICBhd2FpdCB3cml0ZUFsbChidWZmZXIsIHJlc3VsdC52YWx1ZS5zdWJhcnJheShwLmJ5dGVMZW5ndGgpKTtcbiAgICAgICAgICByZXR1cm4gcC5ieXRlTGVuZ3RoO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuID0gYXdhaXQgYnVmZmVyLnJlYWQocCk7XG4gICAgICAgIGlmIChuID09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkKHApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59XG5cbi8qKiBDcmVhdGUgYSBgV3JpdGVyYCBmcm9tIGEgYFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlcmAuICovXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVyRnJvbVN0cmVhbVdyaXRlcihcbiAgc3RyZWFtV3JpdGVyOiBXcml0YWJsZVN0cmVhbURlZmF1bHRXcml0ZXI8VWludDhBcnJheT4sXG4pOiBEZW5vLldyaXRlciB7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgd3JpdGUocDogVWludDhBcnJheSk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgICBhd2FpdCBzdHJlYW1Xcml0ZXIucmVhZHk7XG4gICAgICBhd2FpdCBzdHJlYW1Xcml0ZXIud3JpdGUocCk7XG4gICAgICByZXR1cm4gcC5sZW5ndGg7XG4gICAgfSxcbiAgfTtcbn1cblxuLyoqIENyZWF0ZSBhIGBSZWFkZXJgIGZyb20gYSBgUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkZXJGcm9tU3RyZWFtUmVhZGVyKFxuICBzdHJlYW1SZWFkZXI6IFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlcjxVaW50OEFycmF5Pixcbik6IERlbm8uUmVhZGVyIHtcbiAgY29uc3QgYnVmZmVyID0gbmV3IEJ1ZmZlcigpO1xuXG4gIHJldHVybiB7XG4gICAgYXN5bmMgcmVhZChwOiBVaW50OEFycmF5KTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgICBpZiAoYnVmZmVyLmVtcHR5KCkpIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgc3RyZWFtUmVhZGVyLnJlYWQoKTtcbiAgICAgICAgaWYgKHJlcy5kb25lKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7IC8vIEVPRlxuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgd3JpdGVBbGwoYnVmZmVyLCByZXMudmFsdWUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYnVmZmVyLnJlYWQocCk7XG4gICAgfSxcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXcml0YWJsZVN0cmVhbUZyb21Xcml0ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIElmIHRoZSBgd3JpdGVyYCBpcyBhbHNvIGEgYERlbm8uQ2xvc2VyYCwgYXV0b21hdGljYWxseSBjbG9zZSB0aGUgYHdyaXRlcmBcbiAgICogd2hlbiB0aGUgc3RyZWFtIGlzIGNsb3NlZCwgYWJvcnRlZCwgb3IgYSB3cml0ZSBlcnJvciBvY2N1cnMuXG4gICAqXG4gICAqIERlZmF1bHRzIHRvIGB0cnVlYC4gKi9cbiAgYXV0b0Nsb3NlPzogYm9vbGVhbjtcbn1cblxuLyoqIENyZWF0ZSBhIGBXcml0YWJsZVN0cmVhbWAgZnJvbSBhIGBXcml0ZXJgLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyaXRhYmxlU3RyZWFtRnJvbVdyaXRlcihcbiAgd3JpdGVyOiBEZW5vLldyaXRlcixcbiAgb3B0aW9uczogV3JpdGFibGVTdHJlYW1Gcm9tV3JpdGVyT3B0aW9ucyA9IHt9LFxuKTogV3JpdGFibGVTdHJlYW08VWludDhBcnJheT4ge1xuICBjb25zdCB7IGF1dG9DbG9zZSA9IHRydWUgfSA9IG9wdGlvbnM7XG5cbiAgcmV0dXJuIG5ldyBXcml0YWJsZVN0cmVhbSh7XG4gICAgYXN5bmMgd3JpdGUoY2h1bmssIGNvbnRyb2xsZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHdyaXRlQWxsKHdyaXRlciwgY2h1bmspO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb250cm9sbGVyLmVycm9yKGUpO1xuICAgICAgICBpZiAoaXNDbG9zZXIod3JpdGVyKSAmJiBhdXRvQ2xvc2UpIHtcbiAgICAgICAgICB3cml0ZXIuY2xvc2UoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgY2xvc2UoKSB7XG4gICAgICBpZiAoaXNDbG9zZXIod3JpdGVyKSAmJiBhdXRvQ2xvc2UpIHtcbiAgICAgICAgd3JpdGVyLmNsb3NlKCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBhYm9ydCgpIHtcbiAgICAgIGlmIChpc0Nsb3Nlcih3cml0ZXIpICYmIGF1dG9DbG9zZSkge1xuICAgICAgICB3cml0ZXIuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9LFxuICB9KTtcbn1cblxuLyoqIENyZWF0ZSBhIGBSZWFkYWJsZVN0cmVhbWAgZnJvbSBhbnkga2luZCBvZiBpdGVyYWJsZS5cbiAqXG4gKiBgYGB0c1xuICogICAgICBpbXBvcnQgeyByZWFkYWJsZVN0cmVhbUZyb21JdGVyYWJsZSB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiAgICAgIGNvbnN0IHIxID0gcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGUoW1wiZm9vLCBiYXIsIGJhelwiXSk7XG4gKiAgICAgIGNvbnN0IHIyID0gcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGUoYXN5bmMgZnVuY3Rpb24qICgpIHtcbiAqICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCkpKTtcbiAqICAgICAgICB5aWVsZCBcImZvb1wiO1xuICogICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKCgocikgPT4gc2V0VGltZW91dChyLCAxMDAwKSkpO1xuICogICAgICAgIHlpZWxkIFwiYmFyXCI7XG4gKiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDApKSk7XG4gKiAgICAgICAgeWllbGQgXCJiYXpcIjtcbiAqICAgICAgfSgpKTtcbiAqIGBgYFxuICpcbiAqIElmIHRoZSBwcm9kdWNlZCBpdGVyYXRvciAoYGl0ZXJhYmxlW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpYCBvclxuICogYGl0ZXJhYmxlW1N5bWJvbC5pdGVyYXRvcl0oKWApIGlzIGEgZ2VuZXJhdG9yLCBvciBtb3JlIHNwZWNpZmljYWxseSBpcyBmb3VuZFxuICogdG8gaGF2ZSBhIGAudGhyb3coKWAgbWV0aG9kIG9uIGl0LCB0aGF0IHdpbGwgYmUgY2FsbGVkIHVwb25cbiAqIGByZWFkYWJsZVN0cmVhbS5jYW5jZWwoKWAuIFRoaXMgaXMgdGhlIGNhc2UgZm9yIHRoZSBzZWNvbmQgaW5wdXQgdHlwZSBhYm92ZTpcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGUgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogY29uc3QgcjMgPSByZWFkYWJsZVN0cmVhbUZyb21JdGVyYWJsZShhc3luYyBmdW5jdGlvbiogKCkge1xuICogICB0cnkge1xuICogICAgIHlpZWxkIFwiZm9vXCI7XG4gKiAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gKiAgICAgY29uc29sZS5sb2coZXJyb3IpOyAvLyBFcnJvcjogQ2FuY2VsbGVkIGJ5IGNvbnN1bWVyLlxuICogICB9XG4gKiB9KCkpO1xuICogY29uc3QgcmVhZGVyID0gcjMuZ2V0UmVhZGVyKCk7XG4gKiBjb25zb2xlLmxvZyhhd2FpdCByZWFkZXIucmVhZCgpKTsgLy8geyB2YWx1ZTogXCJmb29cIiwgZG9uZTogZmFsc2UgfVxuICogYXdhaXQgcmVhZGVyLmNhbmNlbChuZXcgRXJyb3IoXCJDYW5jZWxsZWQgYnkgY29uc3VtZXIuXCIpKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGU8VD4oXG4gIGl0ZXJhYmxlOiBJdGVyYWJsZTxUPiB8IEFzeW5jSXRlcmFibGU8VD4sXG4pOiBSZWFkYWJsZVN0cmVhbTxUPiB7XG4gIGNvbnN0IGl0ZXJhdG9yOiBJdGVyYXRvcjxUPiB8IEFzeW5jSXRlcmF0b3I8VD4gPVxuICAgIChpdGVyYWJsZSBhcyBBc3luY0l0ZXJhYmxlPFQ+KVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0/LigpID8/XG4gICAgICAoaXRlcmFibGUgYXMgSXRlcmFibGU8VD4pW1N5bWJvbC5pdGVyYXRvcl0/LigpO1xuICByZXR1cm4gbmV3IFJlYWRhYmxlU3RyZWFtKHtcbiAgICBhc3luYyBwdWxsKGNvbnRyb2xsZXIpIHtcbiAgICAgIGNvbnN0IHsgdmFsdWUsIGRvbmUgfSA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmIChkb25lKSB7XG4gICAgICAgIGNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZSh2YWx1ZSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBhc3luYyBjYW5jZWwocmVhc29uKSB7XG4gICAgICBpZiAodHlwZW9mIGl0ZXJhdG9yLnRocm93ID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGl0ZXJhdG9yLnRocm93KHJlYXNvbik7XG4gICAgICAgIH0gY2F0Y2ggeyAvKiBgaXRlcmF0b3IudGhyb3coKWAgYWx3YXlzIHRocm93cyBvbiBzaXRlLiBXZSBjYXRjaCBpdC4gKi8gfVxuICAgICAgfVxuICAgIH0sXG4gIH0pO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlck9wdGlvbnMge1xuICAvKiogSWYgdGhlIGByZWFkZXJgIGlzIGFsc28gYSBgRGVuby5DbG9zZXJgLCBhdXRvbWF0aWNhbGx5IGNsb3NlIHRoZSBgcmVhZGVyYFxuICAgKiB3aGVuIGBFT0ZgIGlzIGVuY291bnRlcmVkLCBvciBhIHJlYWQgZXJyb3Igb2NjdXJzLlxuICAgKlxuICAgKiBEZWZhdWx0cyB0byBgdHJ1ZWAuICovXG4gIGF1dG9DbG9zZT86IGJvb2xlYW47XG5cbiAgLyoqIFRoZSBzaXplIG9mIGNodW5rcyB0byBhbGxvY2F0ZSB0byByZWFkLCB0aGUgZGVmYXVsdCBpcyB+MTZLaUIsIHdoaWNoIGlzXG4gICAqIHRoZSBtYXhpbXVtIHNpemUgdGhhdCBEZW5vIG9wZXJhdGlvbnMgY2FuIGN1cnJlbnRseSBzdXBwb3J0LiAqL1xuICBjaHVua1NpemU/OiBudW1iZXI7XG5cbiAgLyoqIFRoZSBxdWV1aW5nIHN0cmF0ZWd5IHRvIGNyZWF0ZSB0aGUgYFJlYWRhYmxlU3RyZWFtYCB3aXRoLiAqL1xuICBzdHJhdGVneT86IHsgaGlnaFdhdGVyTWFyaz86IG51bWJlciB8IHVuZGVmaW5lZDsgc2l6ZT86IHVuZGVmaW5lZCB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGBSZWFkYWJsZVN0cmVhbTxVaW50OEFycmF5PmAgZnJvbSBmcm9tIGEgYERlbm8uUmVhZGVyYC5cbiAqXG4gKiBXaGVuIHRoZSBwdWxsIGFsZ29yaXRobSBpcyBjYWxsZWQgb24gdGhlIHN0cmVhbSwgYSBjaHVuayBmcm9tIHRoZSByZWFkZXJcbiAqIHdpbGwgYmUgcmVhZC4gIFdoZW4gYG51bGxgIGlzIHJldHVybmVkIGZyb20gdGhlIHJlYWRlciwgdGhlIHN0cmVhbSB3aWxsIGJlXG4gKiBjbG9zZWQgYWxvbmcgd2l0aCB0aGUgcmVhZGVyIChpZiBpdCBpcyBhbHNvIGEgYERlbm8uQ2xvc2VyYCkuXG4gKlxuICogQW4gZXhhbXBsZSBjb252ZXJ0aW5nIGEgYERlbm8uRnNGaWxlYCBpbnRvIGEgcmVhZGFibGUgc3RyZWFtOlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyByZWFkYWJsZVN0cmVhbUZyb21SZWFkZXIgfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAqXG4gKiBjb25zdCBmaWxlID0gYXdhaXQgRGVuby5vcGVuKFwiLi9maWxlLnR4dFwiLCB7IHJlYWQ6IHRydWUgfSk7XG4gKiBjb25zdCBmaWxlU3RyZWFtID0gcmVhZGFibGVTdHJlYW1Gcm9tUmVhZGVyKGZpbGUpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkYWJsZVN0cmVhbUZyb21SZWFkZXIoXG4gIHJlYWRlcjogRGVuby5SZWFkZXIgfCAoRGVuby5SZWFkZXIgJiBEZW5vLkNsb3NlciksXG4gIG9wdGlvbnM6IFJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlck9wdGlvbnMgPSB7fSxcbik6IFJlYWRhYmxlU3RyZWFtPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3Qge1xuICAgIGF1dG9DbG9zZSA9IHRydWUsXG4gICAgY2h1bmtTaXplID0gREVGQVVMVF9DSFVOS19TSVpFLFxuICAgIHN0cmF0ZWd5LFxuICB9ID0gb3B0aW9ucztcblxuICByZXR1cm4gbmV3IFJlYWRhYmxlU3RyZWFtKHtcbiAgICBhc3luYyBwdWxsKGNvbnRyb2xsZXIpIHtcbiAgICAgIGNvbnN0IGNodW5rID0gbmV3IFVpbnQ4QXJyYXkoY2h1bmtTaXplKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlYWQgPSBhd2FpdCByZWFkZXIucmVhZChjaHVuayk7XG4gICAgICAgIGlmIChyZWFkID09PSBudWxsKSB7XG4gICAgICAgICAgaWYgKGlzQ2xvc2VyKHJlYWRlcikgJiYgYXV0b0Nsb3NlKSB7XG4gICAgICAgICAgICByZWFkZXIuY2xvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udHJvbGxlci5jbG9zZSgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb250cm9sbGVyLmVucXVldWUoY2h1bmsuc3ViYXJyYXkoMCwgcmVhZCkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb250cm9sbGVyLmVycm9yKGUpO1xuICAgICAgICBpZiAoaXNDbG9zZXIocmVhZGVyKSkge1xuICAgICAgICAgIHJlYWRlci5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBjYW5jZWwoKSB7XG4gICAgICBpZiAoaXNDbG9zZXIocmVhZGVyKSAmJiBhdXRvQ2xvc2UpIHtcbiAgICAgICAgcmVhZGVyLmNsb3NlKCk7XG4gICAgICB9XG4gICAgfSxcbiAgfSwgc3RyYXRlZ3kpO1xufVxuXG4vKiogUmVhZCBSZWFkZXIgYHJgIHVudGlsIEVPRiAoYG51bGxgKSBhbmQgcmVzb2x2ZSB0byB0aGUgY29udGVudCBhc1xuICogVWludDhBcnJheWAuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi9pby9idWZmZXIudHNcIjtcbiAqIGltcG9ydCB7IHJlYWRBbGwgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIHN0ZGluXG4gKiBjb25zdCBzdGRpbkNvbnRlbnQgPSBhd2FpdCByZWFkQWxsKERlbm8uc3RkaW4pO1xuICpcbiAqIC8vIEV4YW1wbGUgZnJvbSBmaWxlXG4gKiBjb25zdCBmaWxlID0gYXdhaXQgRGVuby5vcGVuKFwibXlfZmlsZS50eHRcIiwge3JlYWQ6IHRydWV9KTtcbiAqIGNvbnN0IG15RmlsZUNvbnRlbnQgPSBhd2FpdCByZWFkQWxsKGZpbGUpO1xuICogRGVuby5jbG9zZShmaWxlLnJpZCk7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIGJ1ZmZlclxuICogY29uc3QgbXlEYXRhID0gbmV3IFVpbnQ4QXJyYXkoMTAwKTtcbiAqIC8vIC4uLiBmaWxsIG15RGF0YSBhcnJheSB3aXRoIGRhdGFcbiAqIGNvbnN0IHJlYWRlciA9IG5ldyBCdWZmZXIobXlEYXRhLmJ1ZmZlcik7XG4gKiBjb25zdCBidWZmZXJDb250ZW50ID0gYXdhaXQgcmVhZEFsbChyZWFkZXIpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkQWxsKHI6IERlbm8uUmVhZGVyKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gIGNvbnN0IGJ1ZiA9IG5ldyBCdWZmZXIoKTtcbiAgYXdhaXQgYnVmLnJlYWRGcm9tKHIpO1xuICByZXR1cm4gYnVmLmJ5dGVzKCk7XG59XG5cbi8qKiBTeW5jaHJvbm91c2x5IHJlYWRzIFJlYWRlciBgcmAgdW50aWwgRU9GIChgbnVsbGApIGFuZCByZXR1cm5zIHRoZSBjb250ZW50XG4gKiBhcyBgVWludDhBcnJheWAuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi9pby9idWZmZXIudHNcIjtcbiAqIGltcG9ydCB7IHJlYWRBbGxTeW5jIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuICpcbiAqIC8vIEV4YW1wbGUgZnJvbSBzdGRpblxuICogY29uc3Qgc3RkaW5Db250ZW50ID0gcmVhZEFsbFN5bmMoRGVuby5zdGRpbik7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIGZpbGVcbiAqIGNvbnN0IGZpbGUgPSBEZW5vLm9wZW5TeW5jKFwibXlfZmlsZS50eHRcIiwge3JlYWQ6IHRydWV9KTtcbiAqIGNvbnN0IG15RmlsZUNvbnRlbnQgPSByZWFkQWxsU3luYyhmaWxlKTtcbiAqIERlbm8uY2xvc2UoZmlsZS5yaWQpO1xuICpcbiAqIC8vIEV4YW1wbGUgZnJvbSBidWZmZXJcbiAqIGNvbnN0IG15RGF0YSA9IG5ldyBVaW50OEFycmF5KDEwMCk7XG4gKiAvLyAuLi4gZmlsbCBteURhdGEgYXJyYXkgd2l0aCBkYXRhXG4gKiBjb25zdCByZWFkZXIgPSBuZXcgQnVmZmVyKG15RGF0YS5idWZmZXIpO1xuICogY29uc3QgYnVmZmVyQ29udGVudCA9IHJlYWRBbGxTeW5jKHJlYWRlcik7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRBbGxTeW5jKHI6IERlbm8uUmVhZGVyU3luYyk6IFVpbnQ4QXJyYXkge1xuICBjb25zdCBidWYgPSBuZXcgQnVmZmVyKCk7XG4gIGJ1Zi5yZWFkRnJvbVN5bmMocik7XG4gIHJldHVybiBidWYuYnl0ZXMoKTtcbn1cblxuLyoqIFdyaXRlIGFsbCB0aGUgY29udGVudCBvZiB0aGUgYXJyYXkgYnVmZmVyIChgYXJyYCkgdG8gdGhlIHdyaXRlciAoYHdgKS5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2lvL2J1ZmZlci50c1wiO1xuICogaW1wb3J0IHsgd3JpdGVBbGwgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG5cbiAqIC8vIEV4YW1wbGUgd3JpdGluZyB0byBzdGRvdXRcbiAqIGxldCBjb250ZW50Qnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoXCJIZWxsbyBXb3JsZFwiKTtcbiAqIGF3YWl0IHdyaXRlQWxsKERlbm8uc3Rkb3V0LCBjb250ZW50Qnl0ZXMpO1xuICpcbiAqIC8vIEV4YW1wbGUgd3JpdGluZyB0byBmaWxlXG4gKiBjb250ZW50Qnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoXCJIZWxsbyBXb3JsZFwiKTtcbiAqIGNvbnN0IGZpbGUgPSBhd2FpdCBEZW5vLm9wZW4oJ3Rlc3QuZmlsZScsIHt3cml0ZTogdHJ1ZX0pO1xuICogYXdhaXQgd3JpdGVBbGwoZmlsZSwgY29udGVudEJ5dGVzKTtcbiAqIERlbm8uY2xvc2UoZmlsZS5yaWQpO1xuICpcbiAqIC8vIEV4YW1wbGUgd3JpdGluZyB0byBidWZmZXJcbiAqIGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogY29uc3Qgd3JpdGVyID0gbmV3IEJ1ZmZlcigpO1xuICogYXdhaXQgd3JpdGVBbGwod3JpdGVyLCBjb250ZW50Qnl0ZXMpO1xuICogY29uc29sZS5sb2cod3JpdGVyLmJ5dGVzKCkubGVuZ3RoKTsgIC8vIDExXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdyaXRlQWxsKHc6IERlbm8uV3JpdGVyLCBhcnI6IFVpbnQ4QXJyYXkpIHtcbiAgbGV0IG53cml0dGVuID0gMDtcbiAgd2hpbGUgKG53cml0dGVuIDwgYXJyLmxlbmd0aCkge1xuICAgIG53cml0dGVuICs9IGF3YWl0IHcud3JpdGUoYXJyLnN1YmFycmF5KG53cml0dGVuKSk7XG4gIH1cbn1cblxuLyoqIFN5bmNocm9ub3VzbHkgd3JpdGUgYWxsIHRoZSBjb250ZW50IG9mIHRoZSBhcnJheSBidWZmZXIgKGBhcnJgKSB0byB0aGVcbiAqIHdyaXRlciAoYHdgKS5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2lvL2J1ZmZlci50c1wiO1xuICogaW1wb3J0IHsgd3JpdGVBbGxTeW5jIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuICpcbiAqIC8vIEV4YW1wbGUgd3JpdGluZyB0byBzdGRvdXRcbiAqIGxldCBjb250ZW50Qnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoXCJIZWxsbyBXb3JsZFwiKTtcbiAqIHdyaXRlQWxsU3luYyhEZW5vLnN0ZG91dCwgY29udGVudEJ5dGVzKTtcbiAqXG4gKiAvLyBFeGFtcGxlIHdyaXRpbmcgdG8gZmlsZVxuICogY29udGVudEJ5dGVzID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKFwiSGVsbG8gV29ybGRcIik7XG4gKiBjb25zdCBmaWxlID0gRGVuby5vcGVuU3luYygndGVzdC5maWxlJywge3dyaXRlOiB0cnVlfSk7XG4gKiB3cml0ZUFsbFN5bmMoZmlsZSwgY29udGVudEJ5dGVzKTtcbiAqIERlbm8uY2xvc2UoZmlsZS5yaWQpO1xuICpcbiAqIC8vIEV4YW1wbGUgd3JpdGluZyB0byBidWZmZXJcbiAqIGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogY29uc3Qgd3JpdGVyID0gbmV3IEJ1ZmZlcigpO1xuICogd3JpdGVBbGxTeW5jKHdyaXRlciwgY29udGVudEJ5dGVzKTtcbiAqIGNvbnNvbGUubG9nKHdyaXRlci5ieXRlcygpLmxlbmd0aCk7ICAvLyAxMVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUFsbFN5bmModzogRGVuby5Xcml0ZXJTeW5jLCBhcnI6IFVpbnQ4QXJyYXkpOiB2b2lkIHtcbiAgbGV0IG53cml0dGVuID0gMDtcbiAgd2hpbGUgKG53cml0dGVuIDwgYXJyLmxlbmd0aCkge1xuICAgIG53cml0dGVuICs9IHcud3JpdGVTeW5jKGFyci5zdWJhcnJheShud3JpdHRlbikpO1xuICB9XG59XG5cbi8qKiBUdXJucyBhIFJlYWRlciwgYHJgLCBpbnRvIGFuIGFzeW5jIGl0ZXJhdG9yLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBpdGVyYXRlUmVhZGVyIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuICpcbiAqIGxldCBmID0gYXdhaXQgRGVuby5vcGVuKFwiL2V0Yy9wYXNzd2RcIik7XG4gKiBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIGl0ZXJhdGVSZWFkZXIoZikpIHtcbiAqICAgY29uc29sZS5sb2coY2h1bmspO1xuICogfVxuICogZi5jbG9zZSgpO1xuICogYGBgXG4gKlxuICogU2Vjb25kIGFyZ3VtZW50IGNhbiBiZSB1c2VkIHRvIHR1bmUgc2l6ZSBvZiBhIGJ1ZmZlci5cbiAqIERlZmF1bHQgc2l6ZSBvZiB0aGUgYnVmZmVyIGlzIDMya0IuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGl0ZXJhdGVSZWFkZXIgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogbGV0IGYgPSBhd2FpdCBEZW5vLm9wZW4oXCIvZXRjL3Bhc3N3ZFwiKTtcbiAqIGNvbnN0IGl0ID0gaXRlcmF0ZVJlYWRlcihmLCB7XG4gKiAgIGJ1ZlNpemU6IDEwMjQgKiAxMDI0XG4gKiB9KTtcbiAqIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgaXQpIHtcbiAqICAgY29uc29sZS5sb2coY2h1bmspO1xuICogfVxuICogZi5jbG9zZSgpO1xuICogYGBgXG4gKlxuICogSXRlcmF0b3IgdXNlcyBhbiBpbnRlcm5hbCBidWZmZXIgb2YgZml4ZWQgc2l6ZSBmb3IgZWZmaWNpZW5jeTsgaXQgcmV0dXJuc1xuICogYSB2aWV3IG9uIHRoYXQgYnVmZmVyIG9uIGVhY2ggaXRlcmF0aW9uLiBJdCBpcyB0aGVyZWZvcmUgY2FsbGVyJ3NcbiAqIHJlc3BvbnNpYmlsaXR5IHRvIGNvcHkgY29udGVudHMgb2YgdGhlIGJ1ZmZlciBpZiBuZWVkZWQ7IG90aGVyd2lzZSB0aGVcbiAqIG5leHQgaXRlcmF0aW9uIHdpbGwgb3ZlcndyaXRlIGNvbnRlbnRzIG9mIHByZXZpb3VzbHkgcmV0dXJuZWQgY2h1bmsuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogaXRlcmF0ZVJlYWRlcihcbiAgcjogRGVuby5SZWFkZXIsXG4gIG9wdGlvbnM/OiB7XG4gICAgYnVmU2l6ZT86IG51bWJlcjtcbiAgfSxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxVaW50OEFycmF5PiB7XG4gIGNvbnN0IGJ1ZlNpemUgPSBvcHRpb25zPy5idWZTaXplID8/IERFRkFVTFRfQlVGRkVSX1NJWkU7XG4gIGNvbnN0IGIgPSBuZXcgVWludDhBcnJheShidWZTaXplKTtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByLnJlYWQoYik7XG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgeWllbGQgYi5zdWJhcnJheSgwLCByZXN1bHQpO1xuICB9XG59XG5cbi8qKiBUdXJucyBhIFJlYWRlclN5bmMsIGByYCwgaW50byBhbiBpdGVyYXRvci5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgaXRlcmF0ZVJlYWRlclN5bmMgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogbGV0IGYgPSBEZW5vLm9wZW5TeW5jKFwiL2V0Yy9wYXNzd2RcIik7XG4gKiBmb3IgKGNvbnN0IGNodW5rIG9mIGl0ZXJhdGVSZWFkZXJTeW5jKGYpKSB7XG4gKiAgIGNvbnNvbGUubG9nKGNodW5rKTtcbiAqIH1cbiAqIGYuY2xvc2UoKTtcbiAqIGBgYFxuICpcbiAqIFNlY29uZCBhcmd1bWVudCBjYW4gYmUgdXNlZCB0byB0dW5lIHNpemUgb2YgYSBidWZmZXIuXG4gKiBEZWZhdWx0IHNpemUgb2YgdGhlIGJ1ZmZlciBpcyAzMmtCLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBpdGVyYXRlUmVhZGVyU3luYyB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcblxuICogbGV0IGYgPSBhd2FpdCBEZW5vLm9wZW4oXCIvZXRjL3Bhc3N3ZFwiKTtcbiAqIGNvbnN0IGl0ZXIgPSBpdGVyYXRlUmVhZGVyU3luYyhmLCB7XG4gKiAgIGJ1ZlNpemU6IDEwMjQgKiAxMDI0XG4gKiB9KTtcbiAqIGZvciAoY29uc3QgY2h1bmsgb2YgaXRlcikge1xuICogICBjb25zb2xlLmxvZyhjaHVuayk7XG4gKiB9XG4gKiBmLmNsb3NlKCk7XG4gKiBgYGBcbiAqXG4gKiBJdGVyYXRvciB1c2VzIGFuIGludGVybmFsIGJ1ZmZlciBvZiBmaXhlZCBzaXplIGZvciBlZmZpY2llbmN5OyBpdCByZXR1cm5zXG4gKiBhIHZpZXcgb24gdGhhdCBidWZmZXIgb24gZWFjaCBpdGVyYXRpb24uIEl0IGlzIHRoZXJlZm9yZSBjYWxsZXInc1xuICogcmVzcG9uc2liaWxpdHkgdG8gY29weSBjb250ZW50cyBvZiB0aGUgYnVmZmVyIGlmIG5lZWRlZDsgb3RoZXJ3aXNlIHRoZVxuICogbmV4dCBpdGVyYXRpb24gd2lsbCBvdmVyd3JpdGUgY29udGVudHMgb2YgcHJldmlvdXNseSByZXR1cm5lZCBjaHVuay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uKiBpdGVyYXRlUmVhZGVyU3luYyhcbiAgcjogRGVuby5SZWFkZXJTeW5jLFxuICBvcHRpb25zPzoge1xuICAgIGJ1ZlNpemU/OiBudW1iZXI7XG4gIH0sXG4pOiBJdGVyYWJsZUl0ZXJhdG9yPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3QgYnVmU2l6ZSA9IG9wdGlvbnM/LmJ1ZlNpemUgPz8gREVGQVVMVF9CVUZGRVJfU0laRTtcbiAgY29uc3QgYiA9IG5ldyBVaW50OEFycmF5KGJ1ZlNpemUpO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHIucmVhZFN5bmMoYik7XG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgeWllbGQgYi5zdWJhcnJheSgwLCByZXN1bHQpO1xuICB9XG59XG5cbi8qKiBDb3BpZXMgZnJvbSBgc3JjYCB0byBgZHN0YCB1bnRpbCBlaXRoZXIgRU9GIChgbnVsbGApIGlzIHJlYWQgZnJvbSBgc3JjYCBvclxuICogYW4gZXJyb3Igb2NjdXJzLiBJdCByZXNvbHZlcyB0byB0aGUgbnVtYmVyIG9mIGJ5dGVzIGNvcGllZCBvciByZWplY3RzIHdpdGhcbiAqIHRoZSBmaXJzdCBlcnJvciBlbmNvdW50ZXJlZCB3aGlsZSBjb3B5aW5nLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBjb3B5IH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuICpcbiAqIGNvbnN0IHNvdXJjZSA9IGF3YWl0IERlbm8ub3BlbihcIm15X2ZpbGUudHh0XCIpO1xuICogY29uc3QgYnl0ZXNDb3BpZWQxID0gYXdhaXQgY29weShzb3VyY2UsIERlbm8uc3Rkb3V0KTtcbiAqIGNvbnN0IGRlc3RpbmF0aW9uID0gYXdhaXQgRGVuby5jcmVhdGUoXCJteV9maWxlXzIudHh0XCIpO1xuICogY29uc3QgYnl0ZXNDb3BpZWQyID0gYXdhaXQgY29weShzb3VyY2UsIGRlc3RpbmF0aW9uKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBzcmMgVGhlIHNvdXJjZSB0byBjb3B5IGZyb21cbiAqIEBwYXJhbSBkc3QgVGhlIGRlc3RpbmF0aW9uIHRvIGNvcHkgdG9cbiAqIEBwYXJhbSBvcHRpb25zIENhbiBiZSB1c2VkIHRvIHR1bmUgc2l6ZSBvZiB0aGUgYnVmZmVyLiBEZWZhdWx0IHNpemUgaXMgMzJrQlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29weShcbiAgc3JjOiBEZW5vLlJlYWRlcixcbiAgZHN0OiBEZW5vLldyaXRlcixcbiAgb3B0aW9ucz86IHtcbiAgICBidWZTaXplPzogbnVtYmVyO1xuICB9LFxuKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgbGV0IG4gPSAwO1xuICBjb25zdCBidWZTaXplID0gb3B0aW9ucz8uYnVmU2l6ZSA/PyBERUZBVUxUX0JVRkZFUl9TSVpFO1xuICBjb25zdCBiID0gbmV3IFVpbnQ4QXJyYXkoYnVmU2l6ZSk7XG4gIGxldCBnb3RFT0YgPSBmYWxzZTtcbiAgd2hpbGUgKGdvdEVPRiA9PT0gZmFsc2UpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzcmMucmVhZChiKTtcbiAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBnb3RFT0YgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgbndyaXR0ZW4gPSAwO1xuICAgICAgd2hpbGUgKG53cml0dGVuIDwgcmVzdWx0KSB7XG4gICAgICAgIG53cml0dGVuICs9IGF3YWl0IGRzdC53cml0ZShiLnN1YmFycmF5KG53cml0dGVuLCByZXN1bHQpKTtcbiAgICAgIH1cbiAgICAgIG4gKz0gbndyaXR0ZW47XG4gICAgfVxuICB9XG4gIHJldHVybiBuO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSxTQUFTLE1BQU0sUUFBUSxrQkFBa0I7QUFFekMsTUFBTSxxQkFBcUI7QUFDM0IsTUFBTSxzQkFBc0IsS0FBSztBQUVqQyxTQUFTLFNBQVMsS0FBYyxFQUF3QjtJQUN0RCxPQUFPLE9BQU8sVUFBVSxZQUFZLFNBQVMsSUFBSSxJQUFJLFdBQVcsU0FDOUQsbUNBQW1DO0lBQ25DLE9BQU8sQUFBQyxLQUE2QixDQUFDLFFBQVEsS0FBSztBQUN2RDtBQUVBOzs7Ozs7Ozs7Ozs7Ozs7Q0FlQyxHQUNELE9BQU8sU0FBUyxtQkFDZCxRQUEwRCxFQUM3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