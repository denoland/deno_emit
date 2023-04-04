// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright the Browserify authors. MIT License.
// Ported from https://github.com/browserify/path-browserify/
// This module is browser compatible.
import { CHAR_DOT, CHAR_FORWARD_SLASH } from "./_constants.ts";
import { _format, assertPath, encodeWhitespace, isPosixPathSeparator, normalizeString } from "./_util.ts";
export const sep = "/";
export const delimiter = ":";
// path.resolve([from ...], to)
/**
 * Resolves `pathSegments` into an absolute path.
 * @param pathSegments an array of path segments
 */ export function resolve(...pathSegments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--){
        let path;
        if (i >= 0) path = pathSegments[i];
        else {
            // deno-lint-ignore no-explicit-any
            const { Deno  } = globalThis;
            if (typeof Deno?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno.cwd();
        }
        assertPath(path);
        // Skip empty entries
        if (path.length === 0) {
            continue;
        }
        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    // Normalize the path
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
    if (resolvedAbsolute) {
        if (resolvedPath.length > 0) return `/${resolvedPath}`;
        else return "/";
    } else if (resolvedPath.length > 0) return resolvedPath;
    else return ".";
}
/**
 * Normalize the `path`, resolving `'..'` and `'.'` segments.
 * @param path to be normalized
 */ export function normalize(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const isAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    const trailingSeparator = path.charCodeAt(path.length - 1) === CHAR_FORWARD_SLASH;
    // Normalize the path
    path = normalizeString(path, !isAbsolute, "/", isPosixPathSeparator);
    if (path.length === 0 && !isAbsolute) path = ".";
    if (path.length > 0 && trailingSeparator) path += "/";
    if (isAbsolute) return `/${path}`;
    return path;
}
/**
 * Verifies whether provided path is absolute
 * @param path to be verified as absolute
 */ export function isAbsolute(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === CHAR_FORWARD_SLASH;
}
/**
 * Join all given a sequence of `paths`,then normalizes the resulting path.
 * @param paths to be joined and normalized
 */ export function join(...paths) {
    if (paths.length === 0) return ".";
    let joined;
    for(let i = 0, len = paths.length; i < len; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (!joined) joined = path;
            else joined += `/${path}`;
        }
    }
    if (!joined) return ".";
    return normalize(joined);
}
/**
 * Return the relative path from `from` to `to` based on current working directory.
 * @param from path in current working directory
 * @param to path in current working directory
 */ export function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    from = resolve(from);
    to = resolve(to);
    if (from === to) return "";
    // Trim any leading backslashes
    let fromStart = 1;
    const fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== CHAR_FORWARD_SLASH) break;
    }
    const fromLen = fromEnd - fromStart;
    // Trim any leading backslashes
    let toStart = 1;
    const toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== CHAR_FORWARD_SLASH) break;
    }
    const toLen = toEnd - toStart;
    // Compare paths to find the longest common path from root
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === CHAR_FORWARD_SLASH) {
                    // We get here if `from` is the exact base path for `to`.
                    // For example: from='/foo/bar'; to='/foo/bar/baz'
                    return to.slice(toStart + i + 1);
                } else if (i === 0) {
                    // We get here if `from` is the root
                    // For example: from='/'; to='/foo'
                    return to.slice(toStart + i);
                }
            } else if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === CHAR_FORWARD_SLASH) {
                    // We get here if `to` is the exact base path for `from`.
                    // For example: from='/foo/bar/baz'; to='/foo/bar'
                    lastCommonSep = i;
                } else if (i === 0) {
                    // We get here if `to` is the root.
                    // For example: from='/foo'; to='/'
                    lastCommonSep = 0;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === CHAR_FORWARD_SLASH) lastCommonSep = i;
    }
    let out = "";
    // Generate the relative path based on the path difference between `to`
    // and `from`
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === CHAR_FORWARD_SLASH) {
            if (out.length === 0) out += "..";
            else out += "/..";
        }
    }
    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts
    if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
    else {
        toStart += lastCommonSep;
        if (to.charCodeAt(toStart) === CHAR_FORWARD_SLASH) ++toStart;
        return to.slice(toStart);
    }
}
/**
 * Resolves path to a namespace path
 * @param path to resolve to namespace
 */ export function toNamespacedPath(path) {
    // Non-op on posix systems
    return path;
}
/**
 * Return the directory name of a `path`.
 * @param path to determine name for
 */ export function dirname(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const hasRoot = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    let end = -1;
    let matchedSlash = true;
    for(let i = path.length - 1; i >= 1; --i){
        if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            // We saw the first non-path separator
            matchedSlash = false;
        }
    }
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
    return path.slice(0, end);
}
/**
 * Return the last portion of a `path`. Trailing directory separators are ignored.
 * @param path to process
 * @param ext of path directory
 */ export function basename(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= 0; --i){
            const code = path.charCodeAt(i);
            if (code === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    // We saw the first non-path separator, remember this index in case
                    // we need it if the extension ends up not matching
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    // Try to match the explicit extension
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            // We matched the extension, so mark this as the end of our path
                            // component
                            end = i;
                        }
                    } else {
                        // Extension does not match, so our result is the entire path
                        // component
                        extIdx = -1;
                        end = firstNonSlashEnd;
                    }
                }
            }
        }
        if (start === end) end = firstNonSlashEnd;
        else if (end === -1) end = path.length;
        return path.slice(start, end);
    } else {
        for(i = path.length - 1; i >= 0; --i){
            if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
                // If we reached a path separator that was not part of a set of path
                // separators at the end of the string, stop now
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                // We saw the first non-path separator, mark this as the end of our
                // path component
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
/**
 * Return the extension of the `path` with leading period.
 * @param path with extension
 * @returns extension (ex. for `file.ts` returns `.ts`)
 */ export function extname(path) {
    assertPath(path);
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    let preDotState = 0;
    for(let i = path.length - 1; i >= 0; --i){
        const code = path.charCodeAt(i);
        if (code === CHAR_FORWARD_SLASH) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            // We saw the first non-path separator, mark this as the end of our
            // extension
            matchedSlash = false;
            end = i + 1;
        }
        if (code === CHAR_DOT) {
            // If this is our first dot, mark it as the start of our extension
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            // We saw a non-dot and non-path separator before our dot, so we should
            // have a good chance at having a non-empty extension
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
/**
 * Generate a path from `FormatInputPathObject` object.
 * @param pathObject with path
 */ export function format(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("/", pathObject);
}
/**
 * Return a `ParsedPath` object of the `path`.
 * @param path to process
 */ export function parse(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    if (path.length === 0) return ret;
    const isAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    let start;
    if (isAbsolute) {
        ret.root = "/";
        start = 1;
    } else {
        start = 0;
    }
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    let preDotState = 0;
    // Get non-dir info
    for(; i >= start; --i){
        const code = path.charCodeAt(i);
        if (code === CHAR_FORWARD_SLASH) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            // We saw the first non-path separator, mark this as the end of our
            // extension
            matchedSlash = false;
            end = i + 1;
        }
        if (code === CHAR_DOT) {
            // If this is our first dot, mark it as the start of our extension
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            // We saw a non-dot and non-path separator before our dot, so we should
            // have a good chance at having a non-empty extension
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            if (startPart === 0 && isAbsolute) {
                ret.base = ret.name = path.slice(1, end);
            } else {
                ret.base = ret.name = path.slice(startPart, end);
            }
        }
    } else {
        if (startPart === 0 && isAbsolute) {
            ret.name = path.slice(1, startDot);
            ret.base = path.slice(1, end);
        } else {
            ret.name = path.slice(startPart, startDot);
            ret.base = path.slice(startPart, end);
        }
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);
    else if (isAbsolute) ret.dir = "/";
    return ret;
}
/**
 * Converts a file URL to a path string.
 *
 * ```ts
 *      import { fromFileUrl } from "./posix.ts";
 *      fromFileUrl("file:///home/foo"); // "/home/foo"
 * ```
 * @param url of a file URL
 */ export function fromFileUrl(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
/**
 * Converts a path string to a file URL.
 *
 * ```ts
 *      import { toFileUrl } from "./posix.ts";
 *      toFileUrl("/home/foo"); // new URL("file:///home/foo")
 * ```
 * @param path to convert to file URL
 */ export function toFileUrl(path) {
    if (!isAbsolute(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(path.replace(/%/g, "%25").replace(/\\/g, "%5C"));
    return url;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL3BhdGgvcG9zaXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCB0aGUgQnJvd3NlcmlmeSBhdXRob3JzLiBNSVQgTGljZW5zZS5cbi8vIFBvcnRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9icm93c2VyaWZ5L3BhdGgtYnJvd3NlcmlmeS9cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuaW1wb3J0IHR5cGUgeyBGb3JtYXRJbnB1dFBhdGhPYmplY3QsIFBhcnNlZFBhdGggfSBmcm9tIFwiLi9faW50ZXJmYWNlLnRzXCI7XG5pbXBvcnQgeyBDSEFSX0RPVCwgQ0hBUl9GT1JXQVJEX1NMQVNIIH0gZnJvbSBcIi4vX2NvbnN0YW50cy50c1wiO1xuXG5pbXBvcnQge1xuICBfZm9ybWF0LFxuICBhc3NlcnRQYXRoLFxuICBlbmNvZGVXaGl0ZXNwYWNlLFxuICBpc1Bvc2l4UGF0aFNlcGFyYXRvcixcbiAgbm9ybWFsaXplU3RyaW5nLFxufSBmcm9tIFwiLi9fdXRpbC50c1wiO1xuXG5leHBvcnQgY29uc3Qgc2VwID0gXCIvXCI7XG5leHBvcnQgY29uc3QgZGVsaW1pdGVyID0gXCI6XCI7XG5cbi8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcbi8qKlxuICogUmVzb2x2ZXMgYHBhdGhTZWdtZW50c2AgaW50byBhbiBhYnNvbHV0ZSBwYXRoLlxuICogQHBhcmFtIHBhdGhTZWdtZW50cyBhbiBhcnJheSBvZiBwYXRoIHNlZ21lbnRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKC4uLnBhdGhTZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBsZXQgcmVzb2x2ZWRQYXRoID0gXCJcIjtcbiAgbGV0IHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gcGF0aFNlZ21lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgIGxldCBwYXRoOiBzdHJpbmc7XG5cbiAgICBpZiAoaSA+PSAwKSBwYXRoID0gcGF0aFNlZ21lbnRzW2ldO1xuICAgIGVsc2Uge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIGNvbnN0IHsgRGVubyB9ID0gZ2xvYmFsVGhpcyBhcyBhbnk7XG4gICAgICBpZiAodHlwZW9mIERlbm8/LmN3ZCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJSZXNvbHZlZCBhIHJlbGF0aXZlIHBhdGggd2l0aG91dCBhIENXRC5cIik7XG4gICAgICB9XG4gICAgICBwYXRoID0gRGVuby5jd2QoKTtcbiAgICB9XG5cbiAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgLy8gU2tpcCBlbXB0eSBlbnRyaWVzXG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICByZXNvbHZlZFBhdGggPSBgJHtwYXRofS8ke3Jlc29sdmVkUGF0aH1gO1xuICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgLy8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZVN0cmluZyhcbiAgICByZXNvbHZlZFBhdGgsXG4gICAgIXJlc29sdmVkQWJzb2x1dGUsXG4gICAgXCIvXCIsXG4gICAgaXNQb3NpeFBhdGhTZXBhcmF0b3IsXG4gICk7XG5cbiAgaWYgKHJlc29sdmVkQWJzb2x1dGUpIHtcbiAgICBpZiAocmVzb2x2ZWRQYXRoLmxlbmd0aCA+IDApIHJldHVybiBgLyR7cmVzb2x2ZWRQYXRofWA7XG4gICAgZWxzZSByZXR1cm4gXCIvXCI7XG4gIH0gZWxzZSBpZiAocmVzb2x2ZWRQYXRoLmxlbmd0aCA+IDApIHJldHVybiByZXNvbHZlZFBhdGg7XG4gIGVsc2UgcmV0dXJuIFwiLlwiO1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgYHBhdGhgLCByZXNvbHZpbmcgYCcuLidgIGFuZCBgJy4nYCBzZWdtZW50cy5cbiAqIEBwYXJhbSBwYXRoIHRvIGJlIG5vcm1hbGl6ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZShwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiLlwiO1xuXG4gIGNvbnN0IGlzQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcbiAgY29uc3QgdHJhaWxpbmdTZXBhcmF0b3IgPVxuICAgIHBhdGguY2hhckNvZGVBdChwYXRoLmxlbmd0aCAtIDEpID09PSBDSEFSX0ZPUldBUkRfU0xBU0g7XG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHBhdGggPSBub3JtYWxpemVTdHJpbmcocGF0aCwgIWlzQWJzb2x1dGUsIFwiL1wiLCBpc1Bvc2l4UGF0aFNlcGFyYXRvcik7XG5cbiAgaWYgKHBhdGgubGVuZ3RoID09PSAwICYmICFpc0Fic29sdXRlKSBwYXRoID0gXCIuXCI7XG4gIGlmIChwYXRoLmxlbmd0aCA+IDAgJiYgdHJhaWxpbmdTZXBhcmF0b3IpIHBhdGggKz0gXCIvXCI7XG5cbiAgaWYgKGlzQWJzb2x1dGUpIHJldHVybiBgLyR7cGF0aH1gO1xuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBWZXJpZmllcyB3aGV0aGVyIHByb3ZpZGVkIHBhdGggaXMgYWJzb2x1dGVcbiAqIEBwYXJhbSBwYXRoIHRvIGJlIHZlcmlmaWVkIGFzIGFic29sdXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Fic29sdXRlKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBhc3NlcnRQYXRoKHBhdGgpO1xuICByZXR1cm4gcGF0aC5sZW5ndGggPiAwICYmIHBhdGguY2hhckNvZGVBdCgwKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIO1xufVxuXG4vKipcbiAqIEpvaW4gYWxsIGdpdmVuIGEgc2VxdWVuY2Ugb2YgYHBhdGhzYCx0aGVuIG5vcm1hbGl6ZXMgdGhlIHJlc3VsdGluZyBwYXRoLlxuICogQHBhcmFtIHBhdGhzIHRvIGJlIGpvaW5lZCBhbmQgbm9ybWFsaXplZFxuICovXG5leHBvcnQgZnVuY3Rpb24gam9pbiguLi5wYXRoczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAocGF0aHMubGVuZ3RoID09PSAwKSByZXR1cm4gXCIuXCI7XG4gIGxldCBqb2luZWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHBhdGhzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgY29uc3QgcGF0aCA9IHBhdGhzW2ldO1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgaWYgKHBhdGgubGVuZ3RoID4gMCkge1xuICAgICAgaWYgKCFqb2luZWQpIGpvaW5lZCA9IHBhdGg7XG4gICAgICBlbHNlIGpvaW5lZCArPSBgLyR7cGF0aH1gO1xuICAgIH1cbiAgfVxuICBpZiAoIWpvaW5lZCkgcmV0dXJuIFwiLlwiO1xuICByZXR1cm4gbm9ybWFsaXplKGpvaW5lZCk7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSByZWxhdGl2ZSBwYXRoIGZyb20gYGZyb21gIHRvIGB0b2AgYmFzZWQgb24gY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeS5cbiAqIEBwYXJhbSBmcm9tIHBhdGggaW4gY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICogQHBhcmFtIHRvIHBhdGggaW4gY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmUoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChmcm9tKTtcbiAgYXNzZXJ0UGF0aCh0byk7XG5cbiAgaWYgKGZyb20gPT09IHRvKSByZXR1cm4gXCJcIjtcblxuICBmcm9tID0gcmVzb2x2ZShmcm9tKTtcbiAgdG8gPSByZXNvbHZlKHRvKTtcblxuICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiBcIlwiO1xuXG4gIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgbGV0IGZyb21TdGFydCA9IDE7XG4gIGNvbnN0IGZyb21FbmQgPSBmcm9tLmxlbmd0aDtcbiAgZm9yICg7IGZyb21TdGFydCA8IGZyb21FbmQ7ICsrZnJvbVN0YXJ0KSB7XG4gICAgaWYgKGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQpICE9PSBDSEFSX0ZPUldBUkRfU0xBU0gpIGJyZWFrO1xuICB9XG4gIGNvbnN0IGZyb21MZW4gPSBmcm9tRW5kIC0gZnJvbVN0YXJ0O1xuXG4gIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgbGV0IHRvU3RhcnQgPSAxO1xuICBjb25zdCB0b0VuZCA9IHRvLmxlbmd0aDtcbiAgZm9yICg7IHRvU3RhcnQgPCB0b0VuZDsgKyt0b1N0YXJ0KSB7XG4gICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCkgIT09IENIQVJfRk9SV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgY29uc3QgdG9MZW4gPSB0b0VuZCAtIHRvU3RhcnQ7XG5cbiAgLy8gQ29tcGFyZSBwYXRocyB0byBmaW5kIHRoZSBsb25nZXN0IGNvbW1vbiBwYXRoIGZyb20gcm9vdFxuICBjb25zdCBsZW5ndGggPSBmcm9tTGVuIDwgdG9MZW4gPyBmcm9tTGVuIDogdG9MZW47XG4gIGxldCBsYXN0Q29tbW9uU2VwID0gLTE7XG4gIGxldCBpID0gMDtcbiAgZm9yICg7IGkgPD0gbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoaSA9PT0gbGVuZ3RoKSB7XG4gICAgICBpZiAodG9MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCArIGkpID09PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGV4YWN0IGJhc2UgcGF0aCBmb3IgYHRvYC5cbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nL2Zvby9iYXInOyB0bz0nL2Zvby9iYXIvYmF6J1xuICAgICAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0ICsgaSArIDEpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIHJvb3RcbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nLyc7IHRvPScvZm9vJ1xuICAgICAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0ICsgaSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZnJvbUxlbiA+IGxlbmd0aCkge1xuICAgICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpID09PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSBleGFjdCBiYXNlIHBhdGggZm9yIGBmcm9tYC5cbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nL2Zvby9iYXIvYmF6JzsgdG89Jy9mb28vYmFyJ1xuICAgICAgICAgIGxhc3RDb21tb25TZXAgPSBpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSByb290LlxuICAgICAgICAgIC8vIEZvciBleGFtcGxlOiBmcm9tPScvZm9vJzsgdG89Jy8nXG4gICAgICAgICAgbGFzdENvbW1vblNlcCA9IDA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBmcm9tQ29kZSA9IGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQgKyBpKTtcbiAgICBjb25zdCB0b0NvZGUgPSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKTtcbiAgICBpZiAoZnJvbUNvZGUgIT09IHRvQ29kZSkgYnJlYWs7XG4gICAgZWxzZSBpZiAoZnJvbUNvZGUgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkgbGFzdENvbW1vblNlcCA9IGk7XG4gIH1cblxuICBsZXQgb3V0ID0gXCJcIjtcbiAgLy8gR2VuZXJhdGUgdGhlIHJlbGF0aXZlIHBhdGggYmFzZWQgb24gdGhlIHBhdGggZGlmZmVyZW5jZSBiZXR3ZWVuIGB0b2BcbiAgLy8gYW5kIGBmcm9tYFxuICBmb3IgKGkgPSBmcm9tU3RhcnQgKyBsYXN0Q29tbW9uU2VwICsgMTsgaSA8PSBmcm9tRW5kOyArK2kpIHtcbiAgICBpZiAoaSA9PT0gZnJvbUVuZCB8fCBmcm9tLmNoYXJDb2RlQXQoaSkgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkge1xuICAgICAgaWYgKG91dC5sZW5ndGggPT09IDApIG91dCArPSBcIi4uXCI7XG4gICAgICBlbHNlIG91dCArPSBcIi8uLlwiO1xuICAgIH1cbiAgfVxuXG4gIC8vIExhc3RseSwgYXBwZW5kIHRoZSByZXN0IG9mIHRoZSBkZXN0aW5hdGlvbiAoYHRvYCkgcGF0aCB0aGF0IGNvbWVzIGFmdGVyXG4gIC8vIHRoZSBjb21tb24gcGF0aCBwYXJ0c1xuICBpZiAob3V0Lmxlbmd0aCA+IDApIHJldHVybiBvdXQgKyB0by5zbGljZSh0b1N0YXJ0ICsgbGFzdENvbW1vblNlcCk7XG4gIGVsc2Uge1xuICAgIHRvU3RhcnQgKz0gbGFzdENvbW1vblNlcDtcbiAgICBpZiAodG8uY2hhckNvZGVBdCh0b1N0YXJ0KSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSArK3RvU3RhcnQ7XG4gICAgcmV0dXJuIHRvLnNsaWNlKHRvU3RhcnQpO1xuICB9XG59XG5cbi8qKlxuICogUmVzb2x2ZXMgcGF0aCB0byBhIG5hbWVzcGFjZSBwYXRoXG4gKiBAcGFyYW0gcGF0aCB0byByZXNvbHZlIHRvIG5hbWVzcGFjZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9OYW1lc3BhY2VkUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBOb24tb3Agb24gcG9zaXggc3lzdGVtc1xuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGRpcmVjdG9yeSBuYW1lIG9mIGEgYHBhdGhgLlxuICogQHBhcmFtIHBhdGggdG8gZGV0ZXJtaW5lIG5hbWUgZm9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXJuYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGFzc2VydFBhdGgocGF0aCk7XG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiLlwiO1xuICBjb25zdCBoYXNSb290ID0gcGF0aC5jaGFyQ29kZUF0KDApID09PSBDSEFSX0ZPUldBUkRfU0xBU0g7XG4gIGxldCBlbmQgPSAtMTtcbiAgbGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG4gIGZvciAobGV0IGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMTsgLS1pKSB7XG4gICAgaWYgKHBhdGguY2hhckNvZGVBdChpKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG4gICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICBlbmQgPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3JcbiAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmIChlbmQgPT09IC0xKSByZXR1cm4gaGFzUm9vdCA/IFwiL1wiIDogXCIuXCI7XG4gIGlmIChoYXNSb290ICYmIGVuZCA9PT0gMSkgcmV0dXJuIFwiLy9cIjtcbiAgcmV0dXJuIHBhdGguc2xpY2UoMCwgZW5kKTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGxhc3QgcG9ydGlvbiBvZiBhIGBwYXRoYC4gVHJhaWxpbmcgZGlyZWN0b3J5IHNlcGFyYXRvcnMgYXJlIGlnbm9yZWQuXG4gKiBAcGFyYW0gcGF0aCB0byBwcm9jZXNzXG4gKiBAcGFyYW0gZXh0IG9mIHBhdGggZGlyZWN0b3J5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlbmFtZShwYXRoOiBzdHJpbmcsIGV4dCA9IFwiXCIpOiBzdHJpbmcge1xuICBpZiAoZXh0ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGV4dCAhPT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiZXh0XCIgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZycpO1xuICB9XG4gIGFzc2VydFBhdGgocGF0aCk7XG5cbiAgbGV0IHN0YXJ0ID0gMDtcbiAgbGV0IGVuZCA9IC0xO1xuICBsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgbGV0IGk6IG51bWJlcjtcblxuICBpZiAoZXh0ICE9PSB1bmRlZmluZWQgJiYgZXh0Lmxlbmd0aCA+IDAgJiYgZXh0Lmxlbmd0aCA8PSBwYXRoLmxlbmd0aCkge1xuICAgIGlmIChleHQubGVuZ3RoID09PSBwYXRoLmxlbmd0aCAmJiBleHQgPT09IHBhdGgpIHJldHVybiBcIlwiO1xuICAgIGxldCBleHRJZHggPSBleHQubGVuZ3RoIC0gMTtcbiAgICBsZXQgZmlyc3ROb25TbGFzaEVuZCA9IC0xO1xuICAgIGZvciAoaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgICBpZiAoY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG4gICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmaXJzdE5vblNsYXNoRW5kID09PSAtMSkge1xuICAgICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCByZW1lbWJlciB0aGlzIGluZGV4IGluIGNhc2VcbiAgICAgICAgICAvLyB3ZSBuZWVkIGl0IGlmIHRoZSBleHRlbnNpb24gZW5kcyB1cCBub3QgbWF0Y2hpbmdcbiAgICAgICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgICAgICBmaXJzdE5vblNsYXNoRW5kID0gaSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4dElkeCA+PSAwKSB7XG4gICAgICAgICAgLy8gVHJ5IHRvIG1hdGNoIHRoZSBleHBsaWNpdCBleHRlbnNpb25cbiAgICAgICAgICBpZiAoY29kZSA9PT0gZXh0LmNoYXJDb2RlQXQoZXh0SWR4KSkge1xuICAgICAgICAgICAgaWYgKC0tZXh0SWR4ID09PSAtMSkge1xuICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIHRoZSBleHRlbnNpb24sIHNvIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91ciBwYXRoXG4gICAgICAgICAgICAgIC8vIGNvbXBvbmVudFxuICAgICAgICAgICAgICBlbmQgPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFeHRlbnNpb24gZG9lcyBub3QgbWF0Y2gsIHNvIG91ciByZXN1bHQgaXMgdGhlIGVudGlyZSBwYXRoXG4gICAgICAgICAgICAvLyBjb21wb25lbnRcbiAgICAgICAgICAgIGV4dElkeCA9IC0xO1xuICAgICAgICAgICAgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPT09IGVuZCkgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICBlbHNlIGlmIChlbmQgPT09IC0xKSBlbmQgPSBwYXRoLmxlbmd0aDtcbiAgICByZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICBpZiAocGF0aC5jaGFyQ29kZUF0KGkpID09PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcbiAgICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICAgIGlmICghbWF0Y2hlZFNsYXNoKSB7XG4gICAgICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgICAgLy8gcGF0aCBjb21wb25lbnRcbiAgICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgICAgIGVuZCA9IGkgKyAxO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlbmQgPT09IC0xKSByZXR1cm4gXCJcIjtcbiAgICByZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybiB0aGUgZXh0ZW5zaW9uIG9mIHRoZSBgcGF0aGAgd2l0aCBsZWFkaW5nIHBlcmlvZC5cbiAqIEBwYXJhbSBwYXRoIHdpdGggZXh0ZW5zaW9uXG4gKiBAcmV0dXJucyBleHRlbnNpb24gKGV4LiBmb3IgYGZpbGUudHNgIHJldHVybnMgYC50c2ApXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRuYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGFzc2VydFBhdGgocGF0aCk7XG4gIGxldCBzdGFydERvdCA9IC0xO1xuICBsZXQgc3RhcnRQYXJ0ID0gMDtcbiAgbGV0IGVuZCA9IC0xO1xuICBsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgLy8gVHJhY2sgdGhlIHN0YXRlIG9mIGNoYXJhY3RlcnMgKGlmIGFueSkgd2Ugc2VlIGJlZm9yZSBvdXIgZmlyc3QgZG90IGFuZFxuICAvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuICBsZXQgcHJlRG90U3RhdGUgPSAwO1xuICBmb3IgKGxldCBpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgaWYgKGNvZGUgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkge1xuICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgaWYgKCFtYXRjaGVkU2xhc2gpIHtcbiAgICAgICAgc3RhcnRQYXJ0ID0gaSArIDE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG4gICAgICAvLyBleHRlbnNpb25cbiAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgZW5kID0gaSArIDE7XG4gICAgfVxuICAgIGlmIChjb2RlID09PSBDSEFSX0RPVCkge1xuICAgICAgLy8gSWYgdGhpcyBpcyBvdXIgZmlyc3QgZG90LCBtYXJrIGl0IGFzIHRoZSBzdGFydCBvZiBvdXIgZXh0ZW5zaW9uXG4gICAgICBpZiAoc3RhcnREb3QgPT09IC0xKSBzdGFydERvdCA9IGk7XG4gICAgICBlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSkgcHJlRG90U3RhdGUgPSAxO1xuICAgIH0gZWxzZSBpZiAoc3RhcnREb3QgIT09IC0xKSB7XG4gICAgICAvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuICAgICAgLy8gaGF2ZSBhIGdvb2QgY2hhbmNlIGF0IGhhdmluZyBhIG5vbi1lbXB0eSBleHRlbnNpb25cbiAgICAgIHByZURvdFN0YXRlID0gLTE7XG4gICAgfVxuICB9XG5cbiAgaWYgKFxuICAgIHN0YXJ0RG90ID09PSAtMSB8fFxuICAgIGVuZCA9PT0gLTEgfHxcbiAgICAvLyBXZSBzYXcgYSBub24tZG90IGNoYXJhY3RlciBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvdFxuICAgIHByZURvdFN0YXRlID09PSAwIHx8XG4gICAgLy8gVGhlIChyaWdodC1tb3N0KSB0cmltbWVkIHBhdGggY29tcG9uZW50IGlzIGV4YWN0bHkgJy4uJ1xuICAgIChwcmVEb3RTdGF0ZSA9PT0gMSAmJiBzdGFydERvdCA9PT0gZW5kIC0gMSAmJiBzdGFydERvdCA9PT0gc3RhcnRQYXJ0ICsgMSlcbiAgKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbiAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgYSBwYXRoIGZyb20gYEZvcm1hdElucHV0UGF0aE9iamVjdGAgb2JqZWN0LlxuICogQHBhcmFtIHBhdGhPYmplY3Qgd2l0aCBwYXRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXQocGF0aE9iamVjdDogRm9ybWF0SW5wdXRQYXRoT2JqZWN0KTogc3RyaW5nIHtcbiAgaWYgKHBhdGhPYmplY3QgPT09IG51bGwgfHwgdHlwZW9mIHBhdGhPYmplY3QgIT09IFwib2JqZWN0XCIpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgYFRoZSBcInBhdGhPYmplY3RcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgT2JqZWN0LiBSZWNlaXZlZCB0eXBlICR7dHlwZW9mIHBhdGhPYmplY3R9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBfZm9ybWF0KFwiL1wiLCBwYXRoT2JqZWN0KTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSBgUGFyc2VkUGF0aGAgb2JqZWN0IG9mIHRoZSBgcGF0aGAuXG4gKiBAcGFyYW0gcGF0aCB0byBwcm9jZXNzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShwYXRoOiBzdHJpbmcpOiBQYXJzZWRQYXRoIHtcbiAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICBjb25zdCByZXQ6IFBhcnNlZFBhdGggPSB7IHJvb3Q6IFwiXCIsIGRpcjogXCJcIiwgYmFzZTogXCJcIiwgZXh0OiBcIlwiLCBuYW1lOiBcIlwiIH07XG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHJldDtcbiAgY29uc3QgaXNBYnNvbHV0ZSA9IHBhdGguY2hhckNvZGVBdCgwKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIO1xuICBsZXQgc3RhcnQ6IG51bWJlcjtcbiAgaWYgKGlzQWJzb2x1dGUpIHtcbiAgICByZXQucm9vdCA9IFwiL1wiO1xuICAgIHN0YXJ0ID0gMTtcbiAgfSBlbHNlIHtcbiAgICBzdGFydCA9IDA7XG4gIH1cbiAgbGV0IHN0YXJ0RG90ID0gLTE7XG4gIGxldCBzdGFydFBhcnQgPSAwO1xuICBsZXQgZW5kID0gLTE7XG4gIGxldCBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICBsZXQgaSA9IHBhdGgubGVuZ3RoIC0gMTtcblxuICAvLyBUcmFjayB0aGUgc3RhdGUgb2YgY2hhcmFjdGVycyAoaWYgYW55KSB3ZSBzZWUgYmVmb3JlIG91ciBmaXJzdCBkb3QgYW5kXG4gIC8vIGFmdGVyIGFueSBwYXRoIHNlcGFyYXRvciB3ZSBmaW5kXG4gIGxldCBwcmVEb3RTdGF0ZSA9IDA7XG5cbiAgLy8gR2V0IG5vbi1kaXIgaW5mb1xuICBmb3IgKDsgaSA+PSBzdGFydDsgLS1pKSB7XG4gICAgY29uc3QgY29kZSA9IHBhdGguY2hhckNvZGVBdChpKTtcbiAgICBpZiAoY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG4gICAgICAvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICBzdGFydFBhcnQgPSBpICsgMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgIC8vIGV4dGVuc2lvblxuICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgICBlbmQgPSBpICsgMTtcbiAgICB9XG4gICAgaWYgKGNvZGUgPT09IENIQVJfRE9UKSB7XG4gICAgICAvLyBJZiB0aGlzIGlzIG91ciBmaXJzdCBkb3QsIG1hcmsgaXQgYXMgdGhlIHN0YXJ0IG9mIG91ciBleHRlbnNpb25cbiAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpIHN0YXJ0RG90ID0gaTtcbiAgICAgIGVsc2UgaWYgKHByZURvdFN0YXRlICE9PSAxKSBwcmVEb3RTdGF0ZSA9IDE7XG4gICAgfSBlbHNlIGlmIChzdGFydERvdCAhPT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgYW5kIG5vbi1wYXRoIHNlcGFyYXRvciBiZWZvcmUgb3VyIGRvdCwgc28gd2Ugc2hvdWxkXG4gICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgcHJlRG90U3RhdGUgPSAtMTtcbiAgICB9XG4gIH1cblxuICBpZiAoXG4gICAgc3RhcnREb3QgPT09IC0xIHx8XG4gICAgZW5kID09PSAtMSB8fFxuICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG4gICAgcHJlRG90U3RhdGUgPT09IDAgfHxcbiAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgKHByZURvdFN0YXRlID09PSAxICYmIHN0YXJ0RG90ID09PSBlbmQgLSAxICYmIHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKVxuICApIHtcbiAgICBpZiAoZW5kICE9PSAtMSkge1xuICAgICAgaWYgKHN0YXJ0UGFydCA9PT0gMCAmJiBpc0Fic29sdXRlKSB7XG4gICAgICAgIHJldC5iYXNlID0gcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKDEsIGVuZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXQuYmFzZSA9IHJldC5uYW1lID0gcGF0aC5zbGljZShzdGFydFBhcnQsIGVuZCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChzdGFydFBhcnQgPT09IDAgJiYgaXNBYnNvbHV0ZSkge1xuICAgICAgcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKDEsIHN0YXJ0RG90KTtcbiAgICAgIHJldC5iYXNlID0gcGF0aC5zbGljZSgxLCBlbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXQubmFtZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBzdGFydERvdCk7XG4gICAgICByZXQuYmFzZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBlbmQpO1xuICAgIH1cbiAgICByZXQuZXh0ID0gcGF0aC5zbGljZShzdGFydERvdCwgZW5kKTtcbiAgfVxuXG4gIGlmIChzdGFydFBhcnQgPiAwKSByZXQuZGlyID0gcGF0aC5zbGljZSgwLCBzdGFydFBhcnQgLSAxKTtcbiAgZWxzZSBpZiAoaXNBYnNvbHV0ZSkgcmV0LmRpciA9IFwiL1wiO1xuXG4gIHJldHVybiByZXQ7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBmaWxlIFVSTCB0byBhIHBhdGggc3RyaW5nLlxuICpcbiAqIGBgYHRzXG4gKiAgICAgIGltcG9ydCB7IGZyb21GaWxlVXJsIH0gZnJvbSBcIi4vcG9zaXgudHNcIjtcbiAqICAgICAgZnJvbUZpbGVVcmwoXCJmaWxlOi8vL2hvbWUvZm9vXCIpOyAvLyBcIi9ob21lL2Zvb1wiXG4gKiBgYGBcbiAqIEBwYXJhbSB1cmwgb2YgYSBmaWxlIFVSTFxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbUZpbGVVcmwodXJsOiBzdHJpbmcgfCBVUkwpOiBzdHJpbmcge1xuICB1cmwgPSB1cmwgaW5zdGFuY2VvZiBVUkwgPyB1cmwgOiBuZXcgVVJMKHVybCk7XG4gIGlmICh1cmwucHJvdG9jb2wgIT0gXCJmaWxlOlwiKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk11c3QgYmUgYSBmaWxlIFVSTC5cIik7XG4gIH1cbiAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChcbiAgICB1cmwucGF0aG5hbWUucmVwbGFjZSgvJSg/IVswLTlBLUZhLWZdezJ9KS9nLCBcIiUyNVwiKSxcbiAgKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIHBhdGggc3RyaW5nIHRvIGEgZmlsZSBVUkwuXG4gKlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgdG9GaWxlVXJsIH0gZnJvbSBcIi4vcG9zaXgudHNcIjtcbiAqICAgICAgdG9GaWxlVXJsKFwiL2hvbWUvZm9vXCIpOyAvLyBuZXcgVVJMKFwiZmlsZTovLy9ob21lL2Zvb1wiKVxuICogYGBgXG4gKiBAcGFyYW0gcGF0aCB0byBjb252ZXJ0IHRvIGZpbGUgVVJMXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0ZpbGVVcmwocGF0aDogc3RyaW5nKTogVVJMIHtcbiAgaWYgKCFpc0Fic29sdXRlKHBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk11c3QgYmUgYW4gYWJzb2x1dGUgcGF0aC5cIik7XG4gIH1cbiAgY29uc3QgdXJsID0gbmV3IFVSTChcImZpbGU6Ly8vXCIpO1xuICB1cmwucGF0aG5hbWUgPSBlbmNvZGVXaGl0ZXNwYWNlKFxuICAgIHBhdGgucmVwbGFjZSgvJS9nLCBcIiUyNVwiKS5yZXBsYWNlKC9cXFxcL2csIFwiJTVDXCIpLFxuICApO1xuICByZXR1cm4gdXJsO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxpREFBaUQ7QUFDakQsNkRBQTZEO0FBQzdELHFDQUFxQztBQUdyQyxTQUFTLFFBQVEsRUFBRSxrQkFBa0IsUUFBUSxrQkFBa0I7QUFFL0QsU0FDRSxPQUFPLEVBQ1AsVUFBVSxFQUNWLGdCQUFnQixFQUNoQixvQkFBb0IsRUFDcEIsZUFBZSxRQUNWLGFBQWE7QUFFcEIsT0FBTyxNQUFNLE1BQU0sSUFBSTtBQUN2QixPQUFPLE1BQU0sWUFBWSxJQUFJO0FBRTdCLCtCQUErQjtBQUMvQjs7O0NBR0MsR0FDRCxPQUFPLFNBQVMsUUFBUSxHQUFHLFlBQXNCLEVBQVU7SUFDekQsSUFBSSxlQUFlO0lBQ25CLElBQUksbUJBQW1CLEtBQUs7SUFFNUIsSUFBSyxJQUFJLElBQUksYUFBYSxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLGtCQUFrQixJQUFLO1FBQ3ZFLElBQUk7UUFFSixJQUFJLEtBQUssR0FBRyxPQUFPLFlBQVksQ0FBQyxFQUFFO2FBQzdCO1lBQ0gsbUNBQW1DO1lBQ25D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