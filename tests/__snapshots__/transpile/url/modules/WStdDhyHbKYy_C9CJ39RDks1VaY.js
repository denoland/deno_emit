// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/**
 * Provides helper functions to manipulate `Uint8Array` byte slices that are not
 * included on the `Uint8Array` prototype.
 *
 * @module
 */ /** Returns the index of the first occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * A start index can be specified as the third argument that begins the search
 * at that given index. The start index defaults to the start of the array.
 *
 * The complexity of this function is O(source.lenth * needle.length).
 *
 * ```ts
 * import { indexOfNeedle } from "./mod.ts";
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * console.log(indexOfNeedle(source, needle)); // 1
 * console.log(indexOfNeedle(source, needle, 2)); // 3
 * ```
 */ export function indexOfNeedle(source, needle, start = 0) {
    if (start >= source.length) {
        return -1;
    }
    if (start < 0) {
        start = Math.max(0, source.length + start);
    }
    const s = needle[0];
    for(let i = start; i < source.length; i++){
        if (source[i] !== s) continue;
        const pin = i;
        let matched = 1;
        let j = i;
        while(matched < needle.length){
            j++;
            if (source[j] !== needle[j - pin]) {
                break;
            }
            matched++;
        }
        if (matched === needle.length) {
            return pin;
        }
    }
    return -1;
}
/** Returns the index of the last occurrence of the needle array in the source
 * array, or -1 if it is not present.
 *
 * A start index can be specified as the third argument that begins the search
 * at that given index. The start index defaults to the end of the array.
 *
 * The complexity of this function is O(source.lenth * needle.length).
 *
 * ```ts
 * import { lastIndexOfNeedle } from "./mod.ts";
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * console.log(lastIndexOfNeedle(source, needle)); // 5
 * console.log(lastIndexOfNeedle(source, needle, 4)); // 3
 * ```
 */ export function lastIndexOfNeedle(source, needle, start = source.length - 1) {
    if (start < 0) {
        return -1;
    }
    if (start >= source.length) {
        start = source.length - 1;
    }
    const e = needle[needle.length - 1];
    for(let i = start; i >= 0; i--){
        if (source[i] !== e) continue;
        const pin = i;
        let matched = 1;
        let j = i;
        while(matched < needle.length){
            j--;
            if (source[j] !== needle[needle.length - 1 - (pin - j)]) {
                break;
            }
            matched++;
        }
        if (matched === needle.length) {
            return pin - needle.length + 1;
        }
    }
    return -1;
}
/** Returns true if the prefix array appears at the start of the source array,
 * false otherwise.
 *
 * The complexity of this function is O(prefix.length).
 *
 * ```ts
 * import { startsWith } from "./mod.ts";
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const prefix = new Uint8Array([0, 1, 2]);
 * console.log(startsWith(source, prefix)); // true
 * ```
 */ export function startsWith(source, prefix) {
    for(let i = 0, max = prefix.length; i < max; i++){
        if (source[i] !== prefix[i]) return false;
    }
    return true;
}
/** Returns true if the suffix array appears at the end of the source array,
 * false otherwise.
 *
 * The complexity of this function is O(suffix.length).
 *
 * ```ts
 * import { endsWith } from "./mod.ts";
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const suffix = new Uint8Array([1, 2, 3]);
 * console.log(endsWith(source, suffix)); // true
 * ```
 */ export function endsWith(source, suffix) {
    for(let srci = source.length - 1, sfxi = suffix.length - 1; sfxi >= 0; srci--, sfxi--){
        if (source[srci] !== suffix[sfxi]) return false;
    }
    return true;
}
/** Returns a new Uint8Array composed of `count` repetitions of the `source`
 * array.
 *
 * If `count` is negative, a `RangeError` is thrown.
 *
 * ```ts
 * import { repeat } from "./mod.ts";
 * const source = new Uint8Array([0, 1, 2]);
 * console.log(repeat(source, 3)); // [0, 1, 2, 0, 1, 2, 0, 1, 2]
 * console.log(repeat(source, 0)); // []
 * console.log(repeat(source, -1)); // RangeError
 * ```
 */ export function repeat(source, count) {
    if (count === 0) {
        return new Uint8Array();
    }
    if (count < 0) {
        throw new RangeError("bytes: negative repeat count");
    } else if (source.length * count / count !== source.length) {
        throw new Error("bytes: repeat count causes overflow");
    }
    const int = Math.floor(count);
    if (int !== count) {
        throw new Error("bytes: repeat count must be an integer");
    }
    const nb = new Uint8Array(source.length * count);
    let bp = copy(source, nb);
    for(; bp < nb.length; bp *= 2){
        copy(nb.slice(0, bp), nb, bp);
    }
    return nb;
}
/** Concatenate the given arrays into a new Uint8Array.
 *
 * ```ts
 * import { concat } from "./mod.ts";
 * const a = new Uint8Array([0, 1, 2]);
 * const b = new Uint8Array([3, 4, 5]);
 * console.log(concat(a, b)); // [0, 1, 2, 3, 4, 5]
 */ export function concat(...buf) {
    let length = 0;
    for (const b of buf){
        length += b.length;
    }
    const output = new Uint8Array(length);
    let index = 0;
    for (const b of buf){
        output.set(b, index);
        index += b.length;
    }
    return output;
}
/** Returns true if the source array contains the needle array, false otherwise.
 *
 * A start index can be specified as the third argument that begins the search
 * at that given index. The start index defaults to the beginning of the array.
 *
 * The complexity of this function is O(source.length * needle.length).
 *
 * ```ts
 * import { includesNeedle } from "./mod.ts";
 * const source = new Uint8Array([0, 1, 2, 1, 2, 1, 2, 3]);
 * const needle = new Uint8Array([1, 2]);
 * console.log(includesNeedle(source, needle)); // true
 * console.log(includesNeedle(source, needle, 6)); // false
 * ```
 */ export function includesNeedle(source, needle, start = 0) {
    return indexOfNeedle(source, needle, start) !== -1;
}
/** Copy bytes from the `src` array to the `dst` array. Returns the number of
 * bytes copied.
 *
 * If the `src` array is larger than what the `dst` array can hold, only the
 * amount of bytes that fit in the `dst` array are copied.
 *
 * An offset can be specified as the third argument that begins the copy at
 * that given index in the `dst` array. The offset defaults to the beginning of
 * the array.
 *
 * ```ts
 * import { copy } from "./mod.ts";
 * const src = new Uint8Array([9, 8, 7]);
 * const dst = new Uint8Array([0, 1, 2, 3, 4, 5]);
 * console.log(copy(src, dst)); // 3
 * console.log(dst); // [9, 8, 7, 3, 4, 5]
 * ```
 *
 * ```ts
 * import { copy } from "./mod.ts";
 * const src = new Uint8Array([1, 1, 1, 1]);
 * const dst = new Uint8Array([0, 0, 0, 0]);
 * console.log(copy(src, dst, 1)); // 3
 * console.log(dst); // [0, 1, 1, 1]
 * ```
 */ export function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
export { equals } from "./equals.ts";
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL2J5dGVzL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG4vKipcbiAqIFByb3ZpZGVzIGhlbHBlciBmdW5jdGlvbnMgdG8gbWFuaXB1bGF0ZSBgVWludDhBcnJheWAgYnl0ZSBzbGljZXMgdGhhdCBhcmUgbm90XG4gKiBpbmNsdWRlZCBvbiB0aGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZS5cbiAqXG4gKiBAbW9kdWxlXG4gKi9cblxuLyoqIFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIHRoZSBuZWVkbGUgYXJyYXkgaW4gdGhlIHNvdXJjZVxuICogYXJyYXksIG9yIC0xIGlmIGl0IGlzIG5vdCBwcmVzZW50LlxuICpcbiAqIEEgc3RhcnQgaW5kZXggY2FuIGJlIHNwZWNpZmllZCBhcyB0aGUgdGhpcmQgYXJndW1lbnQgdGhhdCBiZWdpbnMgdGhlIHNlYXJjaFxuICogYXQgdGhhdCBnaXZlbiBpbmRleC4gVGhlIHN0YXJ0IGluZGV4IGRlZmF1bHRzIHRvIHRoZSBzdGFydCBvZiB0aGUgYXJyYXkuXG4gKlxuICogVGhlIGNvbXBsZXhpdHkgb2YgdGhpcyBmdW5jdGlvbiBpcyBPKHNvdXJjZS5sZW50aCAqIG5lZWRsZS5sZW5ndGgpLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBpbmRleE9mTmVlZGxlIH0gZnJvbSBcIi4vbW9kLnRzXCI7XG4gKiBjb25zdCBzb3VyY2UgPSBuZXcgVWludDhBcnJheShbMCwgMSwgMiwgMSwgMiwgMSwgMiwgM10pO1xuICogY29uc3QgbmVlZGxlID0gbmV3IFVpbnQ4QXJyYXkoWzEsIDJdKTtcbiAqIGNvbnNvbGUubG9nKGluZGV4T2ZOZWVkbGUoc291cmNlLCBuZWVkbGUpKTsgLy8gMVxuICogY29uc29sZS5sb2coaW5kZXhPZk5lZWRsZShzb3VyY2UsIG5lZWRsZSwgMikpOyAvLyAzXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluZGV4T2ZOZWVkbGUoXG4gIHNvdXJjZTogVWludDhBcnJheSxcbiAgbmVlZGxlOiBVaW50OEFycmF5LFxuICBzdGFydCA9IDAsXG4pOiBudW1iZXIge1xuICBpZiAoc3RhcnQgPj0gc291cmNlLmxlbmd0aCkge1xuICAgIHJldHVybiAtMTtcbiAgfVxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSBNYXRoLm1heCgwLCBzb3VyY2UubGVuZ3RoICsgc3RhcnQpO1xuICB9XG4gIGNvbnN0IHMgPSBuZWVkbGVbMF07XG4gIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IHNvdXJjZS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzb3VyY2VbaV0gIT09IHMpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHBpbiA9IGk7XG4gICAgbGV0IG1hdGNoZWQgPSAxO1xuICAgIGxldCBqID0gaTtcbiAgICB3aGlsZSAobWF0Y2hlZCA8IG5lZWRsZS5sZW5ndGgpIHtcbiAgICAgIGorKztcbiAgICAgIGlmIChzb3VyY2Vbal0gIT09IG5lZWRsZVtqIC0gcGluXSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIG1hdGNoZWQrKztcbiAgICB9XG4gICAgaWYgKG1hdGNoZWQgPT09IG5lZWRsZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBwaW47XG4gICAgfVxuICB9XG4gIHJldHVybiAtMTtcbn1cblxuLyoqIFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBsYXN0IG9jY3VycmVuY2Ugb2YgdGhlIG5lZWRsZSBhcnJheSBpbiB0aGUgc291cmNlXG4gKiBhcnJheSwgb3IgLTEgaWYgaXQgaXMgbm90IHByZXNlbnQuXG4gKlxuICogQSBzdGFydCBpbmRleCBjYW4gYmUgc3BlY2lmaWVkIGFzIHRoZSB0aGlyZCBhcmd1bWVudCB0aGF0IGJlZ2lucyB0aGUgc2VhcmNoXG4gKiBhdCB0aGF0IGdpdmVuIGluZGV4LiBUaGUgc3RhcnQgaW5kZXggZGVmYXVsdHMgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXkuXG4gKlxuICogVGhlIGNvbXBsZXhpdHkgb2YgdGhpcyBmdW5jdGlvbiBpcyBPKHNvdXJjZS5sZW50aCAqIG5lZWRsZS5sZW5ndGgpLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBsYXN0SW5kZXhPZk5lZWRsZSB9IGZyb20gXCIuL21vZC50c1wiO1xuICogY29uc3Qgc291cmNlID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDEsIDIsIDEsIDIsIDEsIDIsIDNdKTtcbiAqIGNvbnN0IG5lZWRsZSA9IG5ldyBVaW50OEFycmF5KFsxLCAyXSk7XG4gKiBjb25zb2xlLmxvZyhsYXN0SW5kZXhPZk5lZWRsZShzb3VyY2UsIG5lZWRsZSkpOyAvLyA1XG4gKiBjb25zb2xlLmxvZyhsYXN0SW5kZXhPZk5lZWRsZShzb3VyY2UsIG5lZWRsZSwgNCkpOyAvLyAzXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxhc3RJbmRleE9mTmVlZGxlKFxuICBzb3VyY2U6IFVpbnQ4QXJyYXksXG4gIG5lZWRsZTogVWludDhBcnJheSxcbiAgc3RhcnQgPSBzb3VyY2UubGVuZ3RoIC0gMSxcbik6IG51bWJlciB7XG4gIGlmIChzdGFydCA8IDApIHtcbiAgICByZXR1cm4gLTE7XG4gIH1cbiAgaWYgKHN0YXJ0ID49IHNvdXJjZS5sZW5ndGgpIHtcbiAgICBzdGFydCA9IHNvdXJjZS5sZW5ndGggLSAxO1xuICB9XG4gIGNvbnN0IGUgPSBuZWVkbGVbbmVlZGxlLmxlbmd0aCAtIDFdO1xuICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKHNvdXJjZVtpXSAhPT0gZSkgY29udGludWU7XG4gICAgY29uc3QgcGluID0gaTtcbiAgICBsZXQgbWF0Y2hlZCA9IDE7XG4gICAgbGV0IGogPSBpO1xuICAgIHdoaWxlIChtYXRjaGVkIDwgbmVlZGxlLmxlbmd0aCkge1xuICAgICAgai0tO1xuICAgICAgaWYgKHNvdXJjZVtqXSAhPT0gbmVlZGxlW25lZWRsZS5sZW5ndGggLSAxIC0gKHBpbiAtIGopXSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIG1hdGNoZWQrKztcbiAgICB9XG4gICAgaWYgKG1hdGNoZWQgPT09IG5lZWRsZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBwaW4gLSBuZWVkbGUubGVuZ3RoICsgMTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHRoZSBwcmVmaXggYXJyYXkgYXBwZWFycyBhdCB0aGUgc3RhcnQgb2YgdGhlIHNvdXJjZSBhcnJheSxcbiAqIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBUaGUgY29tcGxleGl0eSBvZiB0aGlzIGZ1bmN0aW9uIGlzIE8ocHJlZml4Lmxlbmd0aCkuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHN0YXJ0c1dpdGggfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAqIGNvbnN0IHNvdXJjZSA9IG5ldyBVaW50OEFycmF5KFswLCAxLCAyLCAxLCAyLCAxLCAyLCAzXSk7XG4gKiBjb25zdCBwcmVmaXggPSBuZXcgVWludDhBcnJheShbMCwgMSwgMl0pO1xuICogY29uc29sZS5sb2coc3RhcnRzV2l0aChzb3VyY2UsIHByZWZpeCkpOyAvLyB0cnVlXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0c1dpdGgoc291cmNlOiBVaW50OEFycmF5LCBwcmVmaXg6IFVpbnQ4QXJyYXkpOiBib29sZWFuIHtcbiAgZm9yIChsZXQgaSA9IDAsIG1heCA9IHByZWZpeC5sZW5ndGg7IGkgPCBtYXg7IGkrKykge1xuICAgIGlmIChzb3VyY2VbaV0gIT09IHByZWZpeFtpXSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHRoZSBzdWZmaXggYXJyYXkgYXBwZWFycyBhdCB0aGUgZW5kIG9mIHRoZSBzb3VyY2UgYXJyYXksXG4gKiBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogVGhlIGNvbXBsZXhpdHkgb2YgdGhpcyBmdW5jdGlvbiBpcyBPKHN1ZmZpeC5sZW5ndGgpLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBlbmRzV2l0aCB9IGZyb20gXCIuL21vZC50c1wiO1xuICogY29uc3Qgc291cmNlID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDEsIDIsIDEsIDIsIDEsIDIsIDNdKTtcbiAqIGNvbnN0IHN1ZmZpeCA9IG5ldyBVaW50OEFycmF5KFsxLCAyLCAzXSk7XG4gKiBjb25zb2xlLmxvZyhlbmRzV2l0aChzb3VyY2UsIHN1ZmZpeCkpOyAvLyB0cnVlXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuZHNXaXRoKHNvdXJjZTogVWludDhBcnJheSwgc3VmZml4OiBVaW50OEFycmF5KTogYm9vbGVhbiB7XG4gIGZvciAoXG4gICAgbGV0IHNyY2kgPSBzb3VyY2UubGVuZ3RoIC0gMSwgc2Z4aSA9IHN1ZmZpeC5sZW5ndGggLSAxO1xuICAgIHNmeGkgPj0gMDtcbiAgICBzcmNpLS0sIHNmeGktLVxuICApIHtcbiAgICBpZiAoc291cmNlW3NyY2ldICE9PSBzdWZmaXhbc2Z4aV0pIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqIFJldHVybnMgYSBuZXcgVWludDhBcnJheSBjb21wb3NlZCBvZiBgY291bnRgIHJlcGV0aXRpb25zIG9mIHRoZSBgc291cmNlYFxuICogYXJyYXkuXG4gKlxuICogSWYgYGNvdW50YCBpcyBuZWdhdGl2ZSwgYSBgUmFuZ2VFcnJvcmAgaXMgdGhyb3duLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyByZXBlYXQgfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAqIGNvbnN0IHNvdXJjZSA9IG5ldyBVaW50OEFycmF5KFswLCAxLCAyXSk7XG4gKiBjb25zb2xlLmxvZyhyZXBlYXQoc291cmNlLCAzKSk7IC8vIFswLCAxLCAyLCAwLCAxLCAyLCAwLCAxLCAyXVxuICogY29uc29sZS5sb2cocmVwZWF0KHNvdXJjZSwgMCkpOyAvLyBbXVxuICogY29uc29sZS5sb2cocmVwZWF0KHNvdXJjZSwgLTEpKTsgLy8gUmFuZ2VFcnJvclxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXQoc291cmNlOiBVaW50OEFycmF5LCBjb3VudDogbnVtYmVyKTogVWludDhBcnJheSB7XG4gIGlmIChjb3VudCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheSgpO1xuICB9XG5cbiAgaWYgKGNvdW50IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiYnl0ZXM6IG5lZ2F0aXZlIHJlcGVhdCBjb3VudFwiKTtcbiAgfSBlbHNlIGlmICgoc291cmNlLmxlbmd0aCAqIGNvdW50KSAvIGNvdW50ICE9PSBzb3VyY2UubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiYnl0ZXM6IHJlcGVhdCBjb3VudCBjYXVzZXMgb3ZlcmZsb3dcIik7XG4gIH1cblxuICBjb25zdCBpbnQgPSBNYXRoLmZsb29yKGNvdW50KTtcblxuICBpZiAoaW50ICE9PSBjb3VudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcImJ5dGVzOiByZXBlYXQgY291bnQgbXVzdCBiZSBhbiBpbnRlZ2VyXCIpO1xuICB9XG5cbiAgY29uc3QgbmIgPSBuZXcgVWludDhBcnJheShzb3VyY2UubGVuZ3RoICogY291bnQpO1xuXG4gIGxldCBicCA9IGNvcHkoc291cmNlLCBuYik7XG5cbiAgZm9yICg7IGJwIDwgbmIubGVuZ3RoOyBicCAqPSAyKSB7XG4gICAgY29weShuYi5zbGljZSgwLCBicCksIG5iLCBicCk7XG4gIH1cblxuICByZXR1cm4gbmI7XG59XG5cbi8qKiBDb25jYXRlbmF0ZSB0aGUgZ2l2ZW4gYXJyYXlzIGludG8gYSBuZXcgVWludDhBcnJheS5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgY29uY2F0IH0gZnJvbSBcIi4vbW9kLnRzXCI7XG4gKiBjb25zdCBhID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDEsIDJdKTtcbiAqIGNvbnN0IGIgPSBuZXcgVWludDhBcnJheShbMywgNCwgNV0pO1xuICogY29uc29sZS5sb2coY29uY2F0KGEsIGIpKTsgLy8gWzAsIDEsIDIsIDMsIDQsIDVdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25jYXQoLi4uYnVmOiBVaW50OEFycmF5W10pOiBVaW50OEFycmF5IHtcbiAgbGV0IGxlbmd0aCA9IDA7XG4gIGZvciAoY29uc3QgYiBvZiBidWYpIHtcbiAgICBsZW5ndGggKz0gYi5sZW5ndGg7XG4gIH1cblxuICBjb25zdCBvdXRwdXQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuICBsZXQgaW5kZXggPSAwO1xuICBmb3IgKGNvbnN0IGIgb2YgYnVmKSB7XG4gICAgb3V0cHV0LnNldChiLCBpbmRleCk7XG4gICAgaW5kZXggKz0gYi5sZW5ndGg7XG4gIH1cblxuICByZXR1cm4gb3V0cHV0O1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHRoZSBzb3VyY2UgYXJyYXkgY29udGFpbnMgdGhlIG5lZWRsZSBhcnJheSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEEgc3RhcnQgaW5kZXggY2FuIGJlIHNwZWNpZmllZCBhcyB0aGUgdGhpcmQgYXJndW1lbnQgdGhhdCBiZWdpbnMgdGhlIHNlYXJjaFxuICogYXQgdGhhdCBnaXZlbiBpbmRleC4gVGhlIHN0YXJ0IGluZGV4IGRlZmF1bHRzIHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFycmF5LlxuICpcbiAqIFRoZSBjb21wbGV4aXR5IG9mIHRoaXMgZnVuY3Rpb24gaXMgTyhzb3VyY2UubGVuZ3RoICogbmVlZGxlLmxlbmd0aCkuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGluY2x1ZGVzTmVlZGxlIH0gZnJvbSBcIi4vbW9kLnRzXCI7XG4gKiBjb25zdCBzb3VyY2UgPSBuZXcgVWludDhBcnJheShbMCwgMSwgMiwgMSwgMiwgMSwgMiwgM10pO1xuICogY29uc3QgbmVlZGxlID0gbmV3IFVpbnQ4QXJyYXkoWzEsIDJdKTtcbiAqIGNvbnNvbGUubG9nKGluY2x1ZGVzTmVlZGxlKHNvdXJjZSwgbmVlZGxlKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGluY2x1ZGVzTmVlZGxlKHNvdXJjZSwgbmVlZGxlLCA2KSk7IC8vIGZhbHNlXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluY2x1ZGVzTmVlZGxlKFxuICBzb3VyY2U6IFVpbnQ4QXJyYXksXG4gIG5lZWRsZTogVWludDhBcnJheSxcbiAgc3RhcnQgPSAwLFxuKTogYm9vbGVhbiB7XG4gIHJldHVybiBpbmRleE9mTmVlZGxlKHNvdXJjZSwgbmVlZGxlLCBzdGFydCkgIT09IC0xO1xufVxuXG4vKiogQ29weSBieXRlcyBmcm9tIHRoZSBgc3JjYCBhcnJheSB0byB0aGUgYGRzdGAgYXJyYXkuIFJldHVybnMgdGhlIG51bWJlciBvZlxuICogYnl0ZXMgY29waWVkLlxuICpcbiAqIElmIHRoZSBgc3JjYCBhcnJheSBpcyBsYXJnZXIgdGhhbiB3aGF0IHRoZSBgZHN0YCBhcnJheSBjYW4gaG9sZCwgb25seSB0aGVcbiAqIGFtb3VudCBvZiBieXRlcyB0aGF0IGZpdCBpbiB0aGUgYGRzdGAgYXJyYXkgYXJlIGNvcGllZC5cbiAqXG4gKiBBbiBvZmZzZXQgY2FuIGJlIHNwZWNpZmllZCBhcyB0aGUgdGhpcmQgYXJndW1lbnQgdGhhdCBiZWdpbnMgdGhlIGNvcHkgYXRcbiAqIHRoYXQgZ2l2ZW4gaW5kZXggaW4gdGhlIGBkc3RgIGFycmF5LiBUaGUgb2Zmc2V0IGRlZmF1bHRzIHRvIHRoZSBiZWdpbm5pbmcgb2ZcbiAqIHRoZSBhcnJheS5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgY29weSB9IGZyb20gXCIuL21vZC50c1wiO1xuICogY29uc3Qgc3JjID0gbmV3IFVpbnQ4QXJyYXkoWzksIDgsIDddKTtcbiAqIGNvbnN0IGRzdCA9IG5ldyBVaW50OEFycmF5KFswLCAxLCAyLCAzLCA0LCA1XSk7XG4gKiBjb25zb2xlLmxvZyhjb3B5KHNyYywgZHN0KSk7IC8vIDNcbiAqIGNvbnNvbGUubG9nKGRzdCk7IC8vIFs5LCA4LCA3LCAzLCA0LCA1XVxuICogYGBgXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGNvcHkgfSBmcm9tIFwiLi9tb2QudHNcIjtcbiAqIGNvbnN0IHNyYyA9IG5ldyBVaW50OEFycmF5KFsxLCAxLCAxLCAxXSk7XG4gKiBjb25zdCBkc3QgPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMF0pO1xuICogY29uc29sZS5sb2coY29weShzcmMsIGRzdCwgMSkpOyAvLyAzXG4gKiBjb25zb2xlLmxvZyhkc3QpOyAvLyBbMCwgMSwgMSwgMV1cbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gY29weShzcmM6IFVpbnQ4QXJyYXksIGRzdDogVWludDhBcnJheSwgb2ZmID0gMCk6IG51bWJlciB7XG4gIG9mZiA9IE1hdGgubWF4KDAsIE1hdGgubWluKG9mZiwgZHN0LmJ5dGVMZW5ndGgpKTtcbiAgY29uc3QgZHN0Qnl0ZXNBdmFpbGFibGUgPSBkc3QuYnl0ZUxlbmd0aCAtIG9mZjtcbiAgaWYgKHNyYy5ieXRlTGVuZ3RoID4gZHN0Qnl0ZXNBdmFpbGFibGUpIHtcbiAgICBzcmMgPSBzcmMuc3ViYXJyYXkoMCwgZHN0Qnl0ZXNBdmFpbGFibGUpO1xuICB9XG4gIGRzdC5zZXQoc3JjLCBvZmYpO1xuICByZXR1cm4gc3JjLmJ5dGVMZW5ndGg7XG59XG5cbmV4cG9ydCB7IGVxdWFscyB9IGZyb20gXCIuL2VxdWFscy50c1wiO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckM7Ozs7O0NBS0MsR0FFRDs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsY0FDZCxNQUFrQixFQUNsQixNQUFrQixFQUNsQixRQUFRLENBQUMsRUFDRDtJQUNSLElBQUksU0FBUyxPQUFPLE1BQU0sRUFBRTtRQUMxQixPQUFPLENBQUM7SUFDVixDQUFDO0lBQ0QsSUFBSSxRQUFRLEdBQUc7UUFDYixRQUFRLEtBQUssR0FBRyxDQUFDLEdBQUcsT0FBTyxNQUFNLEdBQUc7SUFDdEMsQ0FBQztJQUNELE1BQU0sSUFBSSxNQUFNLENBQUMsRUFBRTtJQUNuQixJQUFLLElBQUksSUFBSSxPQUFPLElBQUksT0FBTyxNQUFNLEVBQUUsSUFBSztRQUMxQyxJQUFJLE1BQU0sQ0FBQyxFQUFFLEtBQUssR0FBRyxRQUFTO1FBQzlCLE1BQU0sTUFBTTtRQUNaLElBQUksVUFBVTtRQUNkLElBQUksSUFBSTtRQUNSLE1BQU8sVUFBVSxPQUFPLE1BQU0sQ0FBRTtZQUM5QjtZQUNBLElBQUksTUFBTSxDQUFDLEVBQUUsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLEVBQUU7Z0JBQ2pDLEtBQU07WUFDUixDQUFDO1lBQ0Q7UUFDRjtRQUNBLElBQUksWUFBWSxPQUFPLE1BQU0sRUFBRTtZQUM3QixPQUFPO1FBQ1QsQ0FBQztJQUNIO0lBQ0EsT0FBTyxDQUFDO0FBQ1YsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Q0FlQyxHQUNELE9BQU8sU0FBUyxrQkFDZCxNQUFrQixFQUNsQixNQUFrQixFQUNsQixRQUFRLE9BQU8sTUFBTSxHQUFHLENBQUMsRUFDakI7SUFDUixJQUFJLFFBQVEsR0FBRztRQUNiLE9BQU8sQ0FBQztJQUNWLENBQUM7SUFDRCxJQUFJLFNBQVMsT0FBTyxNQUFNLEVBQUU7UUFDMUIsUUFBUSxPQUFPLE1BQU0sR0FBRztJQUMxQixDQUFDO0lBQ0QsTUFBTSxJQUFJLE1BQU0sQ0FBQyxPQUFPLE1BQU0sR0FBRyxFQUFFO0lBQ25DLElBQUssSUFBSSxJQUFJLE9BQU8sS0FBSyxHQUFHLElBQUs7UUFDL0IsSUFBSSxNQUFNLENBQUMsRUFBRSxLQUFLLEdBQUcsUUFBUztRQUM5QixNQUFNLE1BQU07UUFDWixJQUFJLFVBQVU7UUFDZCxJQUFJLElBQUk7UUFDUixNQUFPLFVBQVUsT0FBTyxNQUFNLENBQUU7WUFDOUI7WUFDQSxJQUFJLE1BQU0sQ0FBQyxFQUFFLEtBQUssTUFBTSxDQUFDLE9BQU8sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFO2dCQUN2RCxLQUFNO1lBQ1IsQ0FBQztZQUNEO1FBQ0Y7UUFDQSxJQUFJLFlBQVksT0FBTyxNQUFNLEVBQUU7WUFDN0IsT0FBTyxNQUFNLE9BQU8sTUFBTSxHQUFHO1FBQy9CLENBQUM7SUFDSDtJQUNBLE9BQU8sQ0FBQztBQUNWLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Q0FXQyxHQUNELE9BQU8sU0FBUyxXQUFXLE1BQWtCLEVBQUUsTUFBa0IsRUFBVztJQUMxRSxJQUFLLElBQUksSUFBSSxHQUFHLE1BQU0sT0FBTyxNQUFNLEVBQUUsSUFBSSxLQUFLLElBQUs7UUFDakQsSUFBSSxNQUFNLENBQUMsRUFBRSxLQUFLLE1BQU0sQ0FBQyxFQUFFLEVBQUUsT0FBTyxLQUFLO0lBQzNDO0lBQ0EsT0FBTyxJQUFJO0FBQ2IsQ0FBQztBQUVEOzs7Ozs7Ozs7OztDQVdDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsTUFBa0IsRUFBRSxNQUFrQixFQUFXO0lBQ3hFLElBQ0UsSUFBSSxPQUFPLE9BQU8sTUFBTSxHQUFHLEdBQUcsT0FBTyxPQUFPLE1BQU0sR0FBRyxHQUNyRCxRQUFRLEdBQ1IsUUFBUSxNQUFNLENBQ2Q7UUFDQSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLEtBQUssRUFBRSxPQUFPLEtBQUs7SUFDakQ7SUFDQSxPQUFPLElBQUk7QUFDYixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLE9BQU8sTUFBa0IsRUFBRSxLQUFhLEVBQWM7SUFDcEUsSUFBSSxVQUFVLEdBQUc7UUFDZixPQUFPLElBQUk7SUFDYixDQUFDO0lBRUQsSUFBSSxRQUFRLEdBQUc7UUFDYixNQUFNLElBQUksV0FBVyxnQ0FBZ0M7SUFDdkQsT0FBTyxJQUFJLEFBQUMsT0FBTyxNQUFNLEdBQUcsUUFBUyxVQUFVLE9BQU8sTUFBTSxFQUFFO1FBQzVELE1BQU0sSUFBSSxNQUFNLHVDQUF1QztJQUN6RCxDQUFDO0lBRUQsTUFBTSxNQUFNLEtBQUssS0FBSyxDQUFDO0lBRXZCLElBQUksUUFBUSxPQUFPO1FBQ2pCLE1BQU0sSUFBSSxNQUFNLDBDQUEwQztJQUM1RCxDQUFDO0lBRUQsTUFBTSxLQUFLLElBQUksV0FBVyxPQUFPLE1BQU0sR0FBRztJQUUxQyxJQUFJLEtBQUssS0FBSyxRQUFRO0lBRXRCLE1BQU8sS0FBSyxHQUFHLE1BQU0sRUFBRSxNQUFNLEVBQUc7UUFDOUIsS0FBSyxHQUFHLEtBQUssQ0FBQyxHQUFHLEtBQUssSUFBSTtJQUM1QjtJQUVBLE9BQU87QUFDVCxDQUFDO0FBRUQ7Ozs7Ozs7Q0FPQyxHQUNELE9BQU8sU0FBUyxPQUFPLEdBQUcsR0FBaUIsRUFBYztJQUN2RCxJQUFJLFNBQVM7SUFDYixLQUFLLE1BQU0sS0FBSyxJQUFLO1FBQ25CLFVBQVUsRUFBRSxNQUFNO0lBQ3BCO0lBRUEsTUFBTSxTQUFTLElBQUksV0FBVztJQUM5QixJQUFJLFFBQVE7SUFDWixLQUFLLE1BQU0sS0FBSyxJQUFLO1FBQ25CLE9BQU8sR0FBRyxDQUFDLEdBQUc7UUFDZCxTQUFTLEVBQUUsTUFBTTtJQUNuQjtJQUVBLE9BQU87QUFDVCxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FDRCxPQUFPLFNBQVMsZUFDZCxNQUFrQixFQUNsQixNQUFrQixFQUNsQixRQUFRLENBQUMsRUFDQTtJQUNULE9BQU8sY0FBYyxRQUFRLFFBQVEsV0FBVyxDQUFDO0FBQ25ELENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlCQyxHQUNELE9BQU8sU0FBUyxLQUFLLEdBQWUsRUFBRSxHQUFlLEVBQUUsTUFBTSxDQUFDLEVBQVU7SUFDdEUsTUFBTSxLQUFLLEdBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLEtBQUssSUFBSSxVQUFVO0lBQzlDLE1BQU0sb0JBQW9CLElBQUksVUFBVSxHQUFHO0lBQzNDLElBQUksSUFBSSxVQUFVLEdBQUcsbUJBQW1CO1FBQ3RDLE1BQU0sSUFBSSxRQUFRLENBQUMsR0FBRztJQUN4QixDQUFDO0lBQ0QsSUFBSSxHQUFHLENBQUMsS0FBSztJQUNiLE9BQU8sSUFBSSxVQUFVO0FBQ3ZCLENBQUM7QUFFRCxTQUFTLE1BQU0sUUFBUSxjQUFjIn0=