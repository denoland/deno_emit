const osType = (()=>{
    const { Deno: Deno1  } = globalThis;
    if (typeof Deno1?.build?.os === "string") {
        return Deno1.build.os;
    }
    const { navigator  } = globalThis;
    if (navigator?.appVersion?.includes?.("Win")) {
        return "windows";
    }
    return "linux";
})();
const isWindows = osType === "windows";
const CHAR_FORWARD_SLASH = 47;
function assertPath(path) {
    if (typeof path !== "string") {
        throw new TypeError(`Path must be a string. Received ${JSON.stringify(path)}`);
    }
}
function isPosixPathSeparator(code) {
    return code === 47;
}
function isPathSeparator(code) {
    return isPosixPathSeparator(code) || code === 92;
}
function isWindowsDeviceRoot(code) {
    return code >= 97 && code <= 122 || code >= 65 && code <= 90;
}
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
    let res = "";
    let lastSegmentLength = 0;
    let lastSlash = -1;
    let dots = 0;
    let code;
    for(let i = 0, len = path.length; i <= len; ++i){
        if (i < len) code = path.charCodeAt(i);
        else if (isPathSeparator(code)) break;
        else code = CHAR_FORWARD_SLASH;
        if (isPathSeparator(code)) {
            if (lastSlash === i - 1 || dots === 1) {} else if (lastSlash !== i - 1 && dots === 2) {
                if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
                    if (res.length > 2) {
                        const lastSlashIndex = res.lastIndexOf(separator);
                        if (lastSlashIndex === -1) {
                            res = "";
                            lastSegmentLength = 0;
                        } else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
                        }
                        lastSlash = i;
                        dots = 0;
                        continue;
                    } else if (res.length === 2 || res.length === 1) {
                        res = "";
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                    }
                }
                if (allowAboveRoot) {
                    if (res.length > 0) res += `${separator}..`;
                    else res = "..";
                    lastSegmentLength = 2;
                }
            } else {
                if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
                else res = path.slice(lastSlash + 1, i);
                lastSegmentLength = i - lastSlash - 1;
            }
            lastSlash = i;
            dots = 0;
        } else if (code === 46 && dots !== -1) {
            ++dots;
        } else {
            dots = -1;
        }
    }
    return res;
}
function _format(sep, pathObject) {
    const dir = pathObject.dir || pathObject.root;
    const base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
    if (!dir) return base;
    if (dir === pathObject.root) return dir + base;
    return dir + sep + base;
}
const WHITESPACE_ENCODINGS = {
    "\u0009": "%09",
    "\u000A": "%0A",
    "\u000B": "%0B",
    "\u000C": "%0C",
    "\u000D": "%0D",
    "\u0020": "%20"
};
function encodeWhitespace(string) {
    return string.replaceAll(/[\s]/g, (c)=>{
        return WHITESPACE_ENCODINGS[c] ?? c;
    });
}
class DenoStdInternalError extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
const sep = "\\";
const delimiter = ";";
function resolve(...pathSegments) {
    let resolvedDevice = "";
    let resolvedTail = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1; i--){
        let path;
        const { Deno: Deno1  } = globalThis;
        if (i >= 0) {
            path = pathSegments[i];
        } else if (!resolvedDevice) {
            if (typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a drive-letter-less path without a CWD.");
            }
            path = Deno1.cwd();
        } else {
            if (typeof Deno1?.env?.get !== "function" || typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno1.cwd();
            if (path === undefined || path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
                path = `${resolvedDevice}\\`;
            }
        }
        assertPath(path);
        const len = path.length;
        if (len === 0) continue;
        let rootEnd = 0;
        let device = "";
        let isAbsolute = false;
        const code = path.charCodeAt(0);
        if (len > 1) {
            if (isPathSeparator(code)) {
                isAbsolute = true;
                if (isPathSeparator(path.charCodeAt(1))) {
                    let j = 2;
                    let last = j;
                    for(; j < len; ++j){
                        if (isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        const firstPart = path.slice(last, j);
                        last = j;
                        for(; j < len; ++j){
                            if (!isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j < len && j !== last) {
                            last = j;
                            for(; j < len; ++j){
                                if (isPathSeparator(path.charCodeAt(j))) break;
                            }
                            if (j === len) {
                                device = `\\\\${firstPart}\\${path.slice(last)}`;
                                rootEnd = j;
                            } else if (j !== last) {
                                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                                rootEnd = j;
                            }
                        }
                    }
                } else {
                    rootEnd = 1;
                }
            } else if (isWindowsDeviceRoot(code)) {
                if (path.charCodeAt(1) === 58) {
                    device = path.slice(0, 2);
                    rootEnd = 2;
                    if (len > 2) {
                        if (isPathSeparator(path.charCodeAt(2))) {
                            isAbsolute = true;
                            rootEnd = 3;
                        }
                    }
                }
            }
        } else if (isPathSeparator(code)) {
            rootEnd = 1;
            isAbsolute = true;
        }
        if (device.length > 0 && resolvedDevice.length > 0 && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
            continue;
        }
        if (resolvedDevice.length === 0 && device.length > 0) {
            resolvedDevice = device;
        }
        if (!resolvedAbsolute) {
            resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
            resolvedAbsolute = isAbsolute;
        }
        if (resolvedAbsolute && resolvedDevice.length > 0) break;
    }
    resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
    return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}
function normalize(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = 0;
    let device;
    let isAbsolute = false;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            isAbsolute = true;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    const firstPart = path.slice(last, j);
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return `\\\\${firstPart}\\${path.slice(last)}\\`;
                        } else if (j !== last) {
                            device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                            rootEnd = j;
                        }
                    }
                }
            } else {
                rootEnd = 1;
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                device = path.slice(0, 2);
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        isAbsolute = true;
                        rootEnd = 3;
                    }
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return "\\";
    }
    let tail;
    if (rootEnd < len) {
        tail = normalizeString(path.slice(rootEnd), !isAbsolute, "\\", isPathSeparator);
    } else {
        tail = "";
    }
    if (tail.length === 0 && !isAbsolute) tail = ".";
    if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
        tail += "\\";
    }
    if (device === undefined) {
        if (isAbsolute) {
            if (tail.length > 0) return `\\${tail}`;
            else return "\\";
        } else if (tail.length > 0) {
            return tail;
        } else {
            return "";
        }
    } else if (isAbsolute) {
        if (tail.length > 0) return `${device}\\${tail}`;
        else return `${device}\\`;
    } else if (tail.length > 0) {
        return device + tail;
    } else {
        return device;
    }
}
function isAbsolute(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return false;
    const code = path.charCodeAt(0);
    if (isPathSeparator(code)) {
        return true;
    } else if (isWindowsDeviceRoot(code)) {
        if (len > 2 && path.charCodeAt(1) === 58) {
            if (isPathSeparator(path.charCodeAt(2))) return true;
        }
    }
    return false;
}
function join(...paths) {
    const pathsCount = paths.length;
    if (pathsCount === 0) return ".";
    let joined;
    let firstPart = null;
    for(let i = 0; i < pathsCount; ++i){
        const path = paths[i];
        assertPath(path);
        if (path.length > 0) {
            if (joined === undefined) joined = firstPart = path;
            else joined += `\\${path}`;
        }
    }
    if (joined === undefined) return ".";
    let needsReplace = true;
    let slashCount = 0;
    assert(firstPart != null);
    if (isPathSeparator(firstPart.charCodeAt(0))) {
        ++slashCount;
        const firstLen = firstPart.length;
        if (firstLen > 1) {
            if (isPathSeparator(firstPart.charCodeAt(1))) {
                ++slashCount;
                if (firstLen > 2) {
                    if (isPathSeparator(firstPart.charCodeAt(2))) ++slashCount;
                    else {
                        needsReplace = false;
                    }
                }
            }
        }
    }
    if (needsReplace) {
        for(; slashCount < joined.length; ++slashCount){
            if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
        }
        if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
    }
    return normalize(joined);
}
function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    const fromOrig = resolve(from);
    const toOrig = resolve(to);
    if (fromOrig === toOrig) return "";
    from = fromOrig.toLowerCase();
    to = toOrig.toLowerCase();
    if (from === to) return "";
    let fromStart = 0;
    let fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 92) break;
    }
    for(; fromEnd - 1 > fromStart; --fromEnd){
        if (from.charCodeAt(fromEnd - 1) !== 92) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 0;
    let toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 92) break;
    }
    for(; toEnd - 1 > toStart; --toEnd){
        if (to.charCodeAt(toEnd - 1) !== 92) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 92) {
                    return toOrig.slice(toStart + i + 1);
                } else if (i === 2) {
                    return toOrig.slice(toStart + i);
                }
            }
            if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 92) {
                    lastCommonSep = i;
                } else if (i === 2) {
                    lastCommonSep = 3;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 92) lastCommonSep = i;
    }
    if (i !== length && lastCommonSep === -1) {
        return toOrig;
    }
    let out = "";
    if (lastCommonSep === -1) lastCommonSep = 0;
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 92) {
            if (out.length === 0) out += "..";
            else out += "\\..";
        }
    }
    if (out.length > 0) {
        return out + toOrig.slice(toStart + lastCommonSep, toEnd);
    } else {
        toStart += lastCommonSep;
        if (toOrig.charCodeAt(toStart) === 92) ++toStart;
        return toOrig.slice(toStart, toEnd);
    }
}
function toNamespacedPath(path) {
    if (typeof path !== "string") return path;
    if (path.length === 0) return "";
    const resolvedPath = resolve(path);
    if (resolvedPath.length >= 3) {
        if (resolvedPath.charCodeAt(0) === 92) {
            if (resolvedPath.charCodeAt(1) === 92) {
                const code = resolvedPath.charCodeAt(2);
                if (code !== 63 && code !== 46) {
                    return `\\\\?\\UNC\\${resolvedPath.slice(2)}`;
                }
            }
        } else if (isWindowsDeviceRoot(resolvedPath.charCodeAt(0))) {
            if (resolvedPath.charCodeAt(1) === 58 && resolvedPath.charCodeAt(2) === 92) {
                return `\\\\?\\${resolvedPath}`;
            }
        }
    }
    return path;
}
function dirname(path) {
    assertPath(path);
    const len = path.length;
    if (len === 0) return ".";
    let rootEnd = -1;
    let end = -1;
    let matchedSlash = true;
    let offset = 0;
    const code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = offset = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            return path;
                        }
                        if (j !== last) {
                            rootEnd = offset = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = offset = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) rootEnd = offset = 3;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        return path;
    }
    for(let i = len - 1; i >= offset; --i){
        if (isPathSeparator(path.charCodeAt(i))) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) {
        if (rootEnd === -1) return ".";
        else end = rootEnd;
    }
    return path.slice(0, end);
}
function basename(path, ext = "") {
    if (ext !== undefined && typeof ext !== "string") {
        throw new TypeError('"ext" argument must be a string');
    }
    assertPath(path);
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    let i;
    if (path.length >= 2) {
        const drive = path.charCodeAt(0);
        if (isWindowsDeviceRoot(drive)) {
            if (path.charCodeAt(1) === 58) start = 2;
        }
    }
    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
        if (ext.length === path.length && ext === path) return "";
        let extIdx = ext.length - 1;
        let firstNonSlashEnd = -1;
        for(i = path.length - 1; i >= start; --i){
            const code = path.charCodeAt(i);
            if (isPathSeparator(code)) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
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
        for(i = path.length - 1; i >= start; --i){
            if (isPathSeparator(path.charCodeAt(i))) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname(path) {
    assertPath(path);
    let start = 0;
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    if (path.length >= 2 && path.charCodeAt(1) === 58 && isWindowsDeviceRoot(path.charCodeAt(0))) {
        start = startPart = 2;
    }
    for(let i = path.length - 1; i >= start; --i){
        const code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("\\", pathObject);
}
function parse(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    const len = path.length;
    if (len === 0) return ret;
    let rootEnd = 0;
    let code = path.charCodeAt(0);
    if (len > 1) {
        if (isPathSeparator(code)) {
            rootEnd = 1;
            if (isPathSeparator(path.charCodeAt(1))) {
                let j = 2;
                let last = j;
                for(; j < len; ++j){
                    if (isPathSeparator(path.charCodeAt(j))) break;
                }
                if (j < len && j !== last) {
                    last = j;
                    for(; j < len; ++j){
                        if (!isPathSeparator(path.charCodeAt(j))) break;
                    }
                    if (j < len && j !== last) {
                        last = j;
                        for(; j < len; ++j){
                            if (isPathSeparator(path.charCodeAt(j))) break;
                        }
                        if (j === len) {
                            rootEnd = j;
                        } else if (j !== last) {
                            rootEnd = j + 1;
                        }
                    }
                }
            }
        } else if (isWindowsDeviceRoot(code)) {
            if (path.charCodeAt(1) === 58) {
                rootEnd = 2;
                if (len > 2) {
                    if (isPathSeparator(path.charCodeAt(2))) {
                        if (len === 3) {
                            ret.root = ret.dir = path;
                            return ret;
                        }
                        rootEnd = 3;
                    }
                } else {
                    ret.root = ret.dir = path;
                    return ret;
                }
            }
        }
    } else if (isPathSeparator(code)) {
        ret.root = ret.dir = path;
        return ret;
    }
    if (rootEnd > 0) ret.root = path.slice(0, rootEnd);
    let startDot = -1;
    let startPart = rootEnd;
    let end = -1;
    let matchedSlash = true;
    let i = path.length - 1;
    let preDotState = 0;
    for(; i >= rootEnd; --i){
        code = path.charCodeAt(i);
        if (isPathSeparator(code)) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        if (end !== -1) {
            ret.base = ret.name = path.slice(startPart, end);
        }
    } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
        ret.ext = path.slice(startDot, end);
    }
    if (startPart > 0 && startPart !== rootEnd) {
        ret.dir = path.slice(0, startPart - 1);
    } else ret.dir = ret.root;
    return ret;
}
function fromFileUrl(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
    if (url.hostname != "") {
        path = `\\\\${url.hostname}${path}`;
    }
    return path;
}
function toFileUrl(path) {
    if (!isAbsolute(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const [, hostname, pathname] = path.match(/^(?:[/\\]{2}([^/\\]+)(?=[/\\](?:[^/\\]|$)))?(.*)/);
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(pathname.replace(/%/g, "%25"));
    if (hostname != null && hostname != "localhost") {
        url.hostname = hostname;
        if (!url.hostname) {
            throw new TypeError("Invalid hostname.");
        }
    }
    return url;
}
const mod = {
    sep: sep,
    delimiter: delimiter,
    resolve: resolve,
    normalize: normalize,
    isAbsolute: isAbsolute,
    join: join,
    relative: relative,
    toNamespacedPath: toNamespacedPath,
    dirname: dirname,
    basename: basename,
    extname: extname,
    format: format,
    parse: parse,
    fromFileUrl: fromFileUrl,
    toFileUrl: toFileUrl
};
const sep1 = "/";
const delimiter1 = ":";
function resolve1(...pathSegments) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for(let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--){
        let path;
        if (i >= 0) path = pathSegments[i];
        else {
            const { Deno: Deno1  } = globalThis;
            if (typeof Deno1?.cwd !== "function") {
                throw new TypeError("Resolved a relative path without a CWD.");
            }
            path = Deno1.cwd();
        }
        assertPath(path);
        if (path.length === 0) {
            continue;
        }
        resolvedPath = `${path}/${resolvedPath}`;
        resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
    }
    resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
    if (resolvedAbsolute) {
        if (resolvedPath.length > 0) return `/${resolvedPath}`;
        else return "/";
    } else if (resolvedPath.length > 0) return resolvedPath;
    else return ".";
}
function normalize1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const isAbsolute = path.charCodeAt(0) === 47;
    const trailingSeparator = path.charCodeAt(path.length - 1) === 47;
    path = normalizeString(path, !isAbsolute, "/", isPosixPathSeparator);
    if (path.length === 0 && !isAbsolute) path = ".";
    if (path.length > 0 && trailingSeparator) path += "/";
    if (isAbsolute) return `/${path}`;
    return path;
}
function isAbsolute1(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47;
}
function join1(...paths) {
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
    return normalize1(joined);
}
function relative1(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    from = resolve1(from);
    to = resolve1(to);
    if (from === to) return "";
    let fromStart = 1;
    const fromEnd = from.length;
    for(; fromStart < fromEnd; ++fromStart){
        if (from.charCodeAt(fromStart) !== 47) break;
    }
    const fromLen = fromEnd - fromStart;
    let toStart = 1;
    const toEnd = to.length;
    for(; toStart < toEnd; ++toStart){
        if (to.charCodeAt(toStart) !== 47) break;
    }
    const toLen = toEnd - toStart;
    const length = fromLen < toLen ? fromLen : toLen;
    let lastCommonSep = -1;
    let i = 0;
    for(; i <= length; ++i){
        if (i === length) {
            if (toLen > length) {
                if (to.charCodeAt(toStart + i) === 47) {
                    return to.slice(toStart + i + 1);
                } else if (i === 0) {
                    return to.slice(toStart + i);
                }
            } else if (fromLen > length) {
                if (from.charCodeAt(fromStart + i) === 47) {
                    lastCommonSep = i;
                } else if (i === 0) {
                    lastCommonSep = 0;
                }
            }
            break;
        }
        const fromCode = from.charCodeAt(fromStart + i);
        const toCode = to.charCodeAt(toStart + i);
        if (fromCode !== toCode) break;
        else if (fromCode === 47) lastCommonSep = i;
    }
    let out = "";
    for(i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i){
        if (i === fromEnd || from.charCodeAt(i) === 47) {
            if (out.length === 0) out += "..";
            else out += "/..";
        }
    }
    if (out.length > 0) return out + to.slice(toStart + lastCommonSep);
    else {
        toStart += lastCommonSep;
        if (to.charCodeAt(toStart) === 47) ++toStart;
        return to.slice(toStart);
    }
}
function toNamespacedPath1(path) {
    return path;
}
function dirname1(path) {
    assertPath(path);
    if (path.length === 0) return ".";
    const hasRoot = path.charCodeAt(0) === 47;
    let end = -1;
    let matchedSlash = true;
    for(let i = path.length - 1; i >= 1; --i){
        if (path.charCodeAt(i) === 47) {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
    return path.slice(0, end);
}
function basename1(path, ext = "") {
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
            if (code === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else {
                if (firstNonSlashEnd === -1) {
                    matchedSlash = false;
                    firstNonSlashEnd = i + 1;
                }
                if (extIdx >= 0) {
                    if (code === ext.charCodeAt(extIdx)) {
                        if (--extIdx === -1) {
                            end = i;
                        }
                    } else {
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
            if (path.charCodeAt(i) === 47) {
                if (!matchedSlash) {
                    start = i + 1;
                    break;
                }
            } else if (end === -1) {
                matchedSlash = false;
                end = i + 1;
            }
        }
        if (end === -1) return "";
        return path.slice(start, end);
    }
}
function extname1(path) {
    assertPath(path);
    let startDot = -1;
    let startPart = 0;
    let end = -1;
    let matchedSlash = true;
    let preDotState = 0;
    for(let i = path.length - 1; i >= 0; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
        return "";
    }
    return path.slice(startDot, end);
}
function format1(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
        throw new TypeError(`The "pathObject" argument must be of type Object. Received type ${typeof pathObject}`);
    }
    return _format("/", pathObject);
}
function parse1(path) {
    assertPath(path);
    const ret = {
        root: "",
        dir: "",
        base: "",
        ext: "",
        name: ""
    };
    if (path.length === 0) return ret;
    const isAbsolute = path.charCodeAt(0) === 47;
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
    let preDotState = 0;
    for(; i >= start; --i){
        const code = path.charCodeAt(i);
        if (code === 47) {
            if (!matchedSlash) {
                startPart = i + 1;
                break;
            }
            continue;
        }
        if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
        if (code === 46) {
            if (startDot === -1) startDot = i;
            else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
            preDotState = -1;
        }
    }
    if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
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
function fromFileUrl1(url) {
    url = url instanceof URL ? url : new URL(url);
    if (url.protocol != "file:") {
        throw new TypeError("Must be a file URL.");
    }
    return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
function toFileUrl1(path) {
    if (!isAbsolute1(path)) {
        throw new TypeError("Must be an absolute path.");
    }
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(path.replace(/%/g, "%25").replace(/\\/g, "%5C"));
    return url;
}
const mod1 = {
    sep: sep1,
    delimiter: delimiter1,
    resolve: resolve1,
    normalize: normalize1,
    isAbsolute: isAbsolute1,
    join: join1,
    relative: relative1,
    toNamespacedPath: toNamespacedPath1,
    dirname: dirname1,
    basename: basename1,
    extname: extname1,
    format: format1,
    parse: parse1,
    fromFileUrl: fromFileUrl1,
    toFileUrl: toFileUrl1
};
const path = isWindows ? mod : mod1;
const { join: join2 , normalize: normalize2  } = path;
const path1 = isWindows ? mod : mod1;
const { basename: basename2 , delimiter: delimiter2 , dirname: dirname2 , extname: extname2 , format: format2 , fromFileUrl: fromFileUrl2 , isAbsolute: isAbsolute2 , join: join3 , normalize: normalize3 , parse: parse2 , relative: relative2 , resolve: resolve2 , sep: sep2 , toFileUrl: toFileUrl2 , toNamespacedPath: toNamespacedPath2  } = path1;
function isCloser(value) {
    return typeof value === "object" && value != null && "close" in value && typeof value["close"] === "function";
}
function readableStreamFromReader(reader, options = {}) {
    const { autoClose =true , chunkSize =16_640 , strategy  } = options;
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
const importMeta = {
    url: "https://deno.land/std@0.140.0/examples/chat/server.ts",
    main: import.meta.main
};
const clients = new Map();
let clientId = 0;
function dispatch(msg) {
    for (const client of clients.values()){
        client.send(msg);
    }
}
function wsHandler(ws) {
    const id = ++clientId;
    clients.set(id, ws);
    ws.onopen = ()=>{
        dispatch(`Connected: [${id}]`);
    };
    ws.onmessage = (e)=>{
        console.log(`msg:${id}`, e.data);
        dispatch(`[${id}]: ${e.data}`);
    };
    ws.onclose = ()=>{
        clients.delete(id);
        dispatch(`Closed: [${id}]`);
    };
}
async function requestHandler(req) {
    const pathname = new URL(req.request.url).pathname;
    if (req.request.method === "GET" && pathname === "/") {
        const u = new URL("./index.html", importMeta.url);
        if (u.protocol.startsWith("http")) {
            fetch(u.href).then(async (resp)=>{
                const body = new Uint8Array(await resp.arrayBuffer());
                req.respondWith(new Response(body, {
                    status: resp.status,
                    headers: {
                        "content-type": "text/html"
                    }
                }));
            });
        } else {
            const file = await Deno.open(fromFileUrl2(u));
            req.respondWith(new Response(readableStreamFromReader(file), {
                status: 200,
                headers: {
                    "content-type": "text/html"
                }
            }));
        }
    } else if (req.request.method === "GET" && pathname === "/favicon.ico") {
        req.respondWith(Response.redirect("https://deno.land/favicon.ico", 302));
    } else if (req.request.method === "GET" && pathname === "/ws") {
        const { socket , response  } = Deno.upgradeWebSocket(req.request);
        wsHandler(socket);
        req.respondWith(response);
    }
}
const server = Deno.listen({
    port: 8080
});
console.log("chat server starting on :8080....");
for await (const conn of server){
    (async ()=>{
        const httpConn = Deno.serveHttp(conn);
        for await (const requestEvent of httpConn){
            requestHandler(requestEvent);
        }
    })();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL191dGlsL29zLnRzIiwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTQwLjAvcGF0aC9fY29uc3RhbnRzLnRzIiwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTQwLjAvcGF0aC9fdXRpbC50cyIsImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL191dGlsL2Fzc2VydC50cyIsImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL3BhdGgvd2luMzIudHMiLCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xNDAuMC9wYXRoL3Bvc2l4LnRzIiwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTQwLjAvcGF0aC9nbG9iLnRzIiwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTQwLjAvcGF0aC9tb2QudHMiLCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xNDAuMC9zdHJlYW1zL2NvbnZlcnNpb24udHMiLCJodHRwczovL2Rlbm8ubGFuZC9zdGRAMC4xNDAuMC9leGFtcGxlcy9jaGF0L3NlcnZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5leHBvcnQgdHlwZSBPU1R5cGUgPSBcIndpbmRvd3NcIiB8IFwibGludXhcIiB8IFwiZGFyd2luXCI7XG5cbmV4cG9ydCBjb25zdCBvc1R5cGU6IE9TVHlwZSA9ICgoKSA9PiB7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IHsgRGVubyB9ID0gZ2xvYmFsVGhpcyBhcyBhbnk7XG4gIGlmICh0eXBlb2YgRGVubz8uYnVpbGQ/Lm9zID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIERlbm8uYnVpbGQub3M7XG4gIH1cblxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBjb25zdCB7IG5hdmlnYXRvciB9ID0gZ2xvYmFsVGhpcyBhcyBhbnk7XG4gIGlmIChuYXZpZ2F0b3I/LmFwcFZlcnNpb24/LmluY2x1ZGVzPy4oXCJXaW5cIikpIHtcbiAgICByZXR1cm4gXCJ3aW5kb3dzXCI7XG4gIH1cblxuICByZXR1cm4gXCJsaW51eFwiO1xufSkoKTtcblxuZXhwb3J0IGNvbnN0IGlzV2luZG93cyA9IG9zVHlwZSA9PT0gXCJ3aW5kb3dzXCI7XG5leHBvcnQgY29uc3QgaXNMaW51eCA9IG9zVHlwZSA9PT0gXCJsaW51eFwiO1xuIiwiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCB0aGUgQnJvd3NlcmlmeSBhdXRob3JzLiBNSVQgTGljZW5zZS5cbi8vIFBvcnRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9icm93c2VyaWZ5L3BhdGgtYnJvd3NlcmlmeS9cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuLy8gQWxwaGFiZXQgY2hhcnMuXG5leHBvcnQgY29uc3QgQ0hBUl9VUFBFUkNBU0VfQSA9IDY1OyAvKiBBICovXG5leHBvcnQgY29uc3QgQ0hBUl9MT1dFUkNBU0VfQSA9IDk3OyAvKiBhICovXG5leHBvcnQgY29uc3QgQ0hBUl9VUFBFUkNBU0VfWiA9IDkwOyAvKiBaICovXG5leHBvcnQgY29uc3QgQ0hBUl9MT1dFUkNBU0VfWiA9IDEyMjsgLyogeiAqL1xuXG4vLyBOb24tYWxwaGFiZXRpYyBjaGFycy5cbmV4cG9ydCBjb25zdCBDSEFSX0RPVCA9IDQ2OyAvKiAuICovXG5leHBvcnQgY29uc3QgQ0hBUl9GT1JXQVJEX1NMQVNIID0gNDc7IC8qIC8gKi9cbmV4cG9ydCBjb25zdCBDSEFSX0JBQ0tXQVJEX1NMQVNIID0gOTI7IC8qIFxcICovXG5leHBvcnQgY29uc3QgQ0hBUl9WRVJUSUNBTF9MSU5FID0gMTI0OyAvKiB8ICovXG5leHBvcnQgY29uc3QgQ0hBUl9DT0xPTiA9IDU4OyAvKiA6ICovXG5leHBvcnQgY29uc3QgQ0hBUl9RVUVTVElPTl9NQVJLID0gNjM7IC8qID8gKi9cbmV4cG9ydCBjb25zdCBDSEFSX1VOREVSU0NPUkUgPSA5NTsgLyogXyAqL1xuZXhwb3J0IGNvbnN0IENIQVJfTElORV9GRUVEID0gMTA7IC8qIFxcbiAqL1xuZXhwb3J0IGNvbnN0IENIQVJfQ0FSUklBR0VfUkVUVVJOID0gMTM7IC8qIFxcciAqL1xuZXhwb3J0IGNvbnN0IENIQVJfVEFCID0gOTsgLyogXFx0ICovXG5leHBvcnQgY29uc3QgQ0hBUl9GT1JNX0ZFRUQgPSAxMjsgLyogXFxmICovXG5leHBvcnQgY29uc3QgQ0hBUl9FWENMQU1BVElPTl9NQVJLID0gMzM7IC8qICEgKi9cbmV4cG9ydCBjb25zdCBDSEFSX0hBU0ggPSAzNTsgLyogIyAqL1xuZXhwb3J0IGNvbnN0IENIQVJfU1BBQ0UgPSAzMjsgLyogICAqL1xuZXhwb3J0IGNvbnN0IENIQVJfTk9fQlJFQUtfU1BBQ0UgPSAxNjA7IC8qIFxcdTAwQTAgKi9cbmV4cG9ydCBjb25zdCBDSEFSX1pFUk9fV0lEVEhfTk9CUkVBS19TUEFDRSA9IDY1Mjc5OyAvKiBcXHVGRUZGICovXG5leHBvcnQgY29uc3QgQ0hBUl9MRUZUX1NRVUFSRV9CUkFDS0VUID0gOTE7IC8qIFsgKi9cbmV4cG9ydCBjb25zdCBDSEFSX1JJR0hUX1NRVUFSRV9CUkFDS0VUID0gOTM7IC8qIF0gKi9cbmV4cG9ydCBjb25zdCBDSEFSX0xFRlRfQU5HTEVfQlJBQ0tFVCA9IDYwOyAvKiA8ICovXG5leHBvcnQgY29uc3QgQ0hBUl9SSUdIVF9BTkdMRV9CUkFDS0VUID0gNjI7IC8qID4gKi9cbmV4cG9ydCBjb25zdCBDSEFSX0xFRlRfQ1VSTFlfQlJBQ0tFVCA9IDEyMzsgLyogeyAqL1xuZXhwb3J0IGNvbnN0IENIQVJfUklHSFRfQ1VSTFlfQlJBQ0tFVCA9IDEyNTsgLyogfSAqL1xuZXhwb3J0IGNvbnN0IENIQVJfSFlQSEVOX01JTlVTID0gNDU7IC8qIC0gKi9cbmV4cG9ydCBjb25zdCBDSEFSX1BMVVMgPSA0MzsgLyogKyAqL1xuZXhwb3J0IGNvbnN0IENIQVJfRE9VQkxFX1FVT1RFID0gMzQ7IC8qIFwiICovXG5leHBvcnQgY29uc3QgQ0hBUl9TSU5HTEVfUVVPVEUgPSAzOTsgLyogJyAqL1xuZXhwb3J0IGNvbnN0IENIQVJfUEVSQ0VOVCA9IDM3OyAvKiAlICovXG5leHBvcnQgY29uc3QgQ0hBUl9TRU1JQ09MT04gPSA1OTsgLyogOyAqL1xuZXhwb3J0IGNvbnN0IENIQVJfQ0lSQ1VNRkxFWF9BQ0NFTlQgPSA5NDsgLyogXiAqL1xuZXhwb3J0IGNvbnN0IENIQVJfR1JBVkVfQUNDRU5UID0gOTY7IC8qIGAgKi9cbmV4cG9ydCBjb25zdCBDSEFSX0FUID0gNjQ7IC8qIEAgKi9cbmV4cG9ydCBjb25zdCBDSEFSX0FNUEVSU0FORCA9IDM4OyAvKiAmICovXG5leHBvcnQgY29uc3QgQ0hBUl9FUVVBTCA9IDYxOyAvKiA9ICovXG5cbi8vIERpZ2l0c1xuZXhwb3J0IGNvbnN0IENIQVJfMCA9IDQ4OyAvKiAwICovXG5leHBvcnQgY29uc3QgQ0hBUl85ID0gNTc7IC8qIDkgKi9cbiIsIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgdGhlIEJyb3dzZXJpZnkgYXV0aG9ycy4gTUlUIExpY2Vuc2UuXG4vLyBQb3J0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vYnJvd3NlcmlmeS9wYXRoLWJyb3dzZXJpZnkvXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmltcG9ydCB0eXBlIHsgRm9ybWF0SW5wdXRQYXRoT2JqZWN0IH0gZnJvbSBcIi4vX2ludGVyZmFjZS50c1wiO1xuaW1wb3J0IHtcbiAgQ0hBUl9CQUNLV0FSRF9TTEFTSCxcbiAgQ0hBUl9ET1QsXG4gIENIQVJfRk9SV0FSRF9TTEFTSCxcbiAgQ0hBUl9MT1dFUkNBU0VfQSxcbiAgQ0hBUl9MT1dFUkNBU0VfWixcbiAgQ0hBUl9VUFBFUkNBU0VfQSxcbiAgQ0hBUl9VUFBFUkNBU0VfWixcbn0gZnJvbSBcIi4vX2NvbnN0YW50cy50c1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UGF0aChwYXRoOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBwYXRoICE9PSBcInN0cmluZ1wiKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgIGBQYXRoIG11c3QgYmUgYSBzdHJpbmcuIFJlY2VpdmVkICR7SlNPTi5zdHJpbmdpZnkocGF0aCl9YCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Bvc2l4UGF0aFNlcGFyYXRvcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNvZGUgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUGF0aFNlcGFyYXRvcihjb2RlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgcmV0dXJuIGlzUG9zaXhQYXRoU2VwYXJhdG9yKGNvZGUpIHx8IGNvZGUgPT09IENIQVJfQkFDS1dBUkRfU0xBU0g7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1dpbmRvd3NEZXZpY2VSb290KGNvZGU6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIChjb2RlID49IENIQVJfTE9XRVJDQVNFX0EgJiYgY29kZSA8PSBDSEFSX0xPV0VSQ0FTRV9aKSB8fFxuICAgIChjb2RlID49IENIQVJfVVBQRVJDQVNFX0EgJiYgY29kZSA8PSBDSEFSX1VQUEVSQ0FTRV9aKVxuICApO1xufVxuXG4vLyBSZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggd2l0aCBkaXJlY3RvcnkgbmFtZXNcbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVTdHJpbmcoXG4gIHBhdGg6IHN0cmluZyxcbiAgYWxsb3dBYm92ZVJvb3Q6IGJvb2xlYW4sXG4gIHNlcGFyYXRvcjogc3RyaW5nLFxuICBpc1BhdGhTZXBhcmF0b3I6IChjb2RlOiBudW1iZXIpID0+IGJvb2xlYW4sXG4pOiBzdHJpbmcge1xuICBsZXQgcmVzID0gXCJcIjtcbiAgbGV0IGxhc3RTZWdtZW50TGVuZ3RoID0gMDtcbiAgbGV0IGxhc3RTbGFzaCA9IC0xO1xuICBsZXQgZG90cyA9IDA7XG4gIGxldCBjb2RlOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwYXRoLmxlbmd0aDsgaSA8PSBsZW47ICsraSkge1xuICAgIGlmIChpIDwgbGVuKSBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgIGVsc2UgaWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlISkpIGJyZWFrO1xuICAgIGVsc2UgY29kZSA9IENIQVJfRk9SV0FSRF9TTEFTSDtcblxuICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSEpKSB7XG4gICAgICBpZiAobGFzdFNsYXNoID09PSBpIC0gMSB8fCBkb3RzID09PSAxKSB7XG4gICAgICAgIC8vIE5PT1BcbiAgICAgIH0gZWxzZSBpZiAobGFzdFNsYXNoICE9PSBpIC0gMSAmJiBkb3RzID09PSAyKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICByZXMubGVuZ3RoIDwgMiB8fFxuICAgICAgICAgIGxhc3RTZWdtZW50TGVuZ3RoICE9PSAyIHx8XG4gICAgICAgICAgcmVzLmNoYXJDb2RlQXQocmVzLmxlbmd0aCAtIDEpICE9PSBDSEFSX0RPVCB8fFxuICAgICAgICAgIHJlcy5jaGFyQ29kZUF0KHJlcy5sZW5ndGggLSAyKSAhPT0gQ0hBUl9ET1RcbiAgICAgICAgKSB7XG4gICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAyKSB7XG4gICAgICAgICAgICBjb25zdCBsYXN0U2xhc2hJbmRleCA9IHJlcy5sYXN0SW5kZXhPZihzZXBhcmF0b3IpO1xuICAgICAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgICByZXMgPSBcIlwiO1xuICAgICAgICAgICAgICBsYXN0U2VnbWVudExlbmd0aCA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXMgPSByZXMuc2xpY2UoMCwgbGFzdFNsYXNoSW5kZXgpO1xuICAgICAgICAgICAgICBsYXN0U2VnbWVudExlbmd0aCA9IHJlcy5sZW5ndGggLSAxIC0gcmVzLmxhc3RJbmRleE9mKHNlcGFyYXRvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0U2xhc2ggPSBpO1xuICAgICAgICAgICAgZG90cyA9IDA7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHJlcy5sZW5ndGggPT09IDIgfHwgcmVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgcmVzID0gXCJcIjtcbiAgICAgICAgICAgIGxhc3RTZWdtZW50TGVuZ3RoID0gMDtcbiAgICAgICAgICAgIGxhc3RTbGFzaCA9IGk7XG4gICAgICAgICAgICBkb3RzID0gMDtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoYWxsb3dBYm92ZVJvb3QpIHtcbiAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDApIHJlcyArPSBgJHtzZXBhcmF0b3J9Li5gO1xuICAgICAgICAgIGVsc2UgcmVzID0gXCIuLlwiO1xuICAgICAgICAgIGxhc3RTZWdtZW50TGVuZ3RoID0gMjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAwKSByZXMgKz0gc2VwYXJhdG9yICsgcGF0aC5zbGljZShsYXN0U2xhc2ggKyAxLCBpKTtcbiAgICAgICAgZWxzZSByZXMgPSBwYXRoLnNsaWNlKGxhc3RTbGFzaCArIDEsIGkpO1xuICAgICAgICBsYXN0U2VnbWVudExlbmd0aCA9IGkgLSBsYXN0U2xhc2ggLSAxO1xuICAgICAgfVxuICAgICAgbGFzdFNsYXNoID0gaTtcbiAgICAgIGRvdHMgPSAwO1xuICAgIH0gZWxzZSBpZiAoY29kZSA9PT0gQ0hBUl9ET1QgJiYgZG90cyAhPT0gLTEpIHtcbiAgICAgICsrZG90cztcbiAgICB9IGVsc2Uge1xuICAgICAgZG90cyA9IC0xO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gX2Zvcm1hdChcbiAgc2VwOiBzdHJpbmcsXG4gIHBhdGhPYmplY3Q6IEZvcm1hdElucHV0UGF0aE9iamVjdCxcbik6IHN0cmluZyB7XG4gIGNvbnN0IGRpcjogc3RyaW5nIHwgdW5kZWZpbmVkID0gcGF0aE9iamVjdC5kaXIgfHwgcGF0aE9iamVjdC5yb290O1xuICBjb25zdCBiYXNlOiBzdHJpbmcgPSBwYXRoT2JqZWN0LmJhc2UgfHxcbiAgICAocGF0aE9iamVjdC5uYW1lIHx8IFwiXCIpICsgKHBhdGhPYmplY3QuZXh0IHx8IFwiXCIpO1xuICBpZiAoIWRpcikgcmV0dXJuIGJhc2U7XG4gIGlmIChkaXIgPT09IHBhdGhPYmplY3Qucm9vdCkgcmV0dXJuIGRpciArIGJhc2U7XG4gIHJldHVybiBkaXIgKyBzZXAgKyBiYXNlO1xufVxuXG5jb25zdCBXSElURVNQQUNFX0VOQ09ESU5HUzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgXCJcXHUwMDA5XCI6IFwiJTA5XCIsXG4gIFwiXFx1MDAwQVwiOiBcIiUwQVwiLFxuICBcIlxcdTAwMEJcIjogXCIlMEJcIixcbiAgXCJcXHUwMDBDXCI6IFwiJTBDXCIsXG4gIFwiXFx1MDAwRFwiOiBcIiUwRFwiLFxuICBcIlxcdTAwMjBcIjogXCIlMjBcIixcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVXaGl0ZXNwYWNlKHN0cmluZzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0cmluZy5yZXBsYWNlQWxsKC9bXFxzXS9nLCAoYykgPT4ge1xuICAgIHJldHVybiBXSElURVNQQUNFX0VOQ09ESU5HU1tjXSA/PyBjO1xuICB9KTtcbn1cbiIsIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmV4cG9ydCBjbGFzcyBEZW5vU3RkSW50ZXJuYWxFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gXCJEZW5vU3RkSW50ZXJuYWxFcnJvclwiO1xuICB9XG59XG5cbi8qKiBNYWtlIGFuIGFzc2VydGlvbiwgaWYgbm90IGB0cnVlYCwgdGhlbiB0aHJvdy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnQoZXhwcjogdW5rbm93biwgbXNnID0gXCJcIik6IGFzc2VydHMgZXhwciB7XG4gIGlmICghZXhwcikge1xuICAgIHRocm93IG5ldyBEZW5vU3RkSW50ZXJuYWxFcnJvcihtc2cpO1xuICB9XG59XG4iLCIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gQ29weXJpZ2h0IHRoZSBCcm93c2VyaWZ5IGF1dGhvcnMuIE1JVCBMaWNlbnNlLlxuLy8gUG9ydGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2Jyb3dzZXJpZnkvcGF0aC1icm93c2VyaWZ5L1xuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5pbXBvcnQgdHlwZSB7IEZvcm1hdElucHV0UGF0aE9iamVjdCwgUGFyc2VkUGF0aCB9IGZyb20gXCIuL19pbnRlcmZhY2UudHNcIjtcbmltcG9ydCB7XG4gIENIQVJfQkFDS1dBUkRfU0xBU0gsXG4gIENIQVJfQ09MT04sXG4gIENIQVJfRE9ULFxuICBDSEFSX1FVRVNUSU9OX01BUkssXG59IGZyb20gXCIuL19jb25zdGFudHMudHNcIjtcblxuaW1wb3J0IHtcbiAgX2Zvcm1hdCxcbiAgYXNzZXJ0UGF0aCxcbiAgZW5jb2RlV2hpdGVzcGFjZSxcbiAgaXNQYXRoU2VwYXJhdG9yLFxuICBpc1dpbmRvd3NEZXZpY2VSb290LFxuICBub3JtYWxpemVTdHJpbmcsXG59IGZyb20gXCIuL191dGlsLnRzXCI7XG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vX3V0aWwvYXNzZXJ0LnRzXCI7XG5cbmV4cG9ydCBjb25zdCBzZXAgPSBcIlxcXFxcIjtcbmV4cG9ydCBjb25zdCBkZWxpbWl0ZXIgPSBcIjtcIjtcblxuLyoqXG4gKiBSZXNvbHZlcyBwYXRoIHNlZ21lbnRzIGludG8gYSBgcGF0aGBcbiAqIEBwYXJhbSBwYXRoU2VnbWVudHMgdG8gcHJvY2VzcyB0byBwYXRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKC4uLnBhdGhTZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBsZXQgcmVzb2x2ZWREZXZpY2UgPSBcIlwiO1xuICBsZXQgcmVzb2x2ZWRUYWlsID0gXCJcIjtcbiAgbGV0IHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gcGF0aFNlZ21lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTE7IGktLSkge1xuICAgIGxldCBwYXRoOiBzdHJpbmc7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCB7IERlbm8gfSA9IGdsb2JhbFRoaXMgYXMgYW55O1xuICAgIGlmIChpID49IDApIHtcbiAgICAgIHBhdGggPSBwYXRoU2VnbWVudHNbaV07XG4gICAgfSBlbHNlIGlmICghcmVzb2x2ZWREZXZpY2UpIHtcbiAgICAgIGlmICh0eXBlb2YgRGVubz8uY3dkICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlJlc29sdmVkIGEgZHJpdmUtbGV0dGVyLWxlc3MgcGF0aCB3aXRob3V0IGEgQ1dELlwiKTtcbiAgICAgIH1cbiAgICAgIHBhdGggPSBEZW5vLmN3ZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoXG4gICAgICAgIHR5cGVvZiBEZW5vPy5lbnY/LmdldCAhPT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiBEZW5vPy5jd2QgIT09IFwiZnVuY3Rpb25cIlxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJSZXNvbHZlZCBhIHJlbGF0aXZlIHBhdGggd2l0aG91dCBhIENXRC5cIik7XG4gICAgICB9XG4gICAgICBwYXRoID0gRGVuby5jd2QoKTtcblxuICAgICAgLy8gVmVyaWZ5IHRoYXQgYSBjd2Qgd2FzIGZvdW5kIGFuZCB0aGF0IGl0IGFjdHVhbGx5IHBvaW50c1xuICAgICAgLy8gdG8gb3VyIGRyaXZlLiBJZiBub3QsIGRlZmF1bHQgdG8gdGhlIGRyaXZlJ3Mgcm9vdC5cbiAgICAgIGlmIChcbiAgICAgICAgcGF0aCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIHBhdGguc2xpY2UoMCwgMykudG9Mb3dlckNhc2UoKSAhPT0gYCR7cmVzb2x2ZWREZXZpY2UudG9Mb3dlckNhc2UoKX1cXFxcYFxuICAgICAgKSB7XG4gICAgICAgIHBhdGggPSBgJHtyZXNvbHZlZERldmljZX1cXFxcYDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgY29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG5cbiAgICAvLyBTa2lwIGVtcHR5IGVudHJpZXNcbiAgICBpZiAobGVuID09PSAwKSBjb250aW51ZTtcblxuICAgIGxldCByb290RW5kID0gMDtcbiAgICBsZXQgZGV2aWNlID0gXCJcIjtcbiAgICBsZXQgaXNBYnNvbHV0ZSA9IGZhbHNlO1xuICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cbiAgICAvLyBUcnkgdG8gbWF0Y2ggYSByb290XG4gICAgaWYgKGxlbiA+IDEpIHtcbiAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgICAgLy8gUG9zc2libGUgVU5DIHJvb3RcblxuICAgICAgICAvLyBJZiB3ZSBzdGFydGVkIHdpdGggYSBzZXBhcmF0b3IsIHdlIGtub3cgd2UgYXQgbGVhc3QgaGF2ZSBhblxuICAgICAgICAvLyBhYnNvbHV0ZSBwYXRoIG9mIHNvbWUga2luZCAoVU5DIG9yIG90aGVyd2lzZSlcbiAgICAgICAgaXNBYnNvbHV0ZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMSkpKSB7XG4gICAgICAgICAgLy8gTWF0Y2hlZCBkb3VibGUgcGF0aCBzZXBhcmF0b3IgYXQgYmVnaW5uaW5nXG4gICAgICAgICAgbGV0IGogPSAyO1xuICAgICAgICAgIGxldCBsYXN0ID0gajtcbiAgICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuICAgICAgICAgIGZvciAoOyBqIDwgbGVuOyArK2opIHtcbiAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChqIDwgbGVuICYmIGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0UGFydCA9IHBhdGguc2xpY2UobGFzdCwgaik7XG4gICAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgICAgbGFzdCA9IGo7XG4gICAgICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgcGF0aCBzZXBhcmF0b3JzXG4gICAgICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgICAgIGlmICghaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChqKSkpIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuICAgICAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgICAgICBsYXN0ID0gajtcbiAgICAgICAgICAgICAgLy8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICAgICAgZm9yICg7IGogPCBsZW47ICsraikge1xuICAgICAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGogPT09IGxlbikge1xuICAgICAgICAgICAgICAgIC8vIFdlIG1hdGNoZWQgYSBVTkMgcm9vdCBvbmx5XG4gICAgICAgICAgICAgICAgZGV2aWNlID0gYFxcXFxcXFxcJHtmaXJzdFBhcnR9XFxcXCR7cGF0aC5zbGljZShsYXN0KX1gO1xuICAgICAgICAgICAgICAgIHJvb3RFbmQgPSBqO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIGEgVU5DIHJvb3Qgd2l0aCBsZWZ0b3ZlcnNcblxuICAgICAgICAgICAgICAgIGRldmljZSA9IGBcXFxcXFxcXCR7Zmlyc3RQYXJ0fVxcXFwke3BhdGguc2xpY2UobGFzdCwgail9YDtcbiAgICAgICAgICAgICAgICByb290RW5kID0gajtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByb290RW5kID0gMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpc1dpbmRvd3NEZXZpY2VSb290KGNvZGUpKSB7XG4gICAgICAgIC8vIFBvc3NpYmxlIGRldmljZSByb290XG5cbiAgICAgICAgaWYgKHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTikge1xuICAgICAgICAgIGRldmljZSA9IHBhdGguc2xpY2UoMCwgMik7XG4gICAgICAgICAgcm9vdEVuZCA9IDI7XG4gICAgICAgICAgaWYgKGxlbiA+IDIpIHtcbiAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KDIpKSkge1xuICAgICAgICAgICAgICAvLyBUcmVhdCBzZXBhcmF0b3IgZm9sbG93aW5nIGRyaXZlIG5hbWUgYXMgYW4gYWJzb2x1dGUgcGF0aFxuICAgICAgICAgICAgICAvLyBpbmRpY2F0b3JcbiAgICAgICAgICAgICAgaXNBYnNvbHV0ZSA9IHRydWU7XG4gICAgICAgICAgICAgIHJvb3RFbmQgPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgICAvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIHBhdGggc2VwYXJhdG9yXG4gICAgICByb290RW5kID0gMTtcbiAgICAgIGlzQWJzb2x1dGUgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIGRldmljZS5sZW5ndGggPiAwICYmXG4gICAgICByZXNvbHZlZERldmljZS5sZW5ndGggPiAwICYmXG4gICAgICBkZXZpY2UudG9Mb3dlckNhc2UoKSAhPT0gcmVzb2x2ZWREZXZpY2UudG9Mb3dlckNhc2UoKVxuICAgICkge1xuICAgICAgLy8gVGhpcyBwYXRoIHBvaW50cyB0byBhbm90aGVyIGRldmljZSBzbyBpdCBpcyBub3QgYXBwbGljYWJsZVxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHJlc29sdmVkRGV2aWNlLmxlbmd0aCA9PT0gMCAmJiBkZXZpY2UubGVuZ3RoID4gMCkge1xuICAgICAgcmVzb2x2ZWREZXZpY2UgPSBkZXZpY2U7XG4gICAgfVxuICAgIGlmICghcmVzb2x2ZWRBYnNvbHV0ZSkge1xuICAgICAgcmVzb2x2ZWRUYWlsID0gYCR7cGF0aC5zbGljZShyb290RW5kKX1cXFxcJHtyZXNvbHZlZFRhaWx9YDtcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBpc0Fic29sdXRlO1xuICAgIH1cblxuICAgIGlmIChyZXNvbHZlZEFic29sdXRlICYmIHJlc29sdmVkRGV2aWNlLmxlbmd0aCA+IDApIGJyZWFrO1xuICB9XG5cbiAgLy8gQXQgdGhpcyBwb2ludCB0aGUgcGF0aCBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gYSBmdWxsIGFic29sdXRlIHBhdGgsXG4gIC8vIGJ1dCBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKVxuICAvLyBmYWlscylcblxuICAvLyBOb3JtYWxpemUgdGhlIHRhaWwgcGF0aFxuICByZXNvbHZlZFRhaWwgPSBub3JtYWxpemVTdHJpbmcoXG4gICAgcmVzb2x2ZWRUYWlsLFxuICAgICFyZXNvbHZlZEFic29sdXRlLFxuICAgIFwiXFxcXFwiLFxuICAgIGlzUGF0aFNlcGFyYXRvcixcbiAgKTtcblxuICByZXR1cm4gcmVzb2x2ZWREZXZpY2UgKyAocmVzb2x2ZWRBYnNvbHV0ZSA/IFwiXFxcXFwiIDogXCJcIikgKyByZXNvbHZlZFRhaWwgfHwgXCIuXCI7XG59XG5cbi8qKlxuICogTm9ybWFsaXplcyBhIGBwYXRoYFxuICogQHBhcmFtIHBhdGggdG8gbm9ybWFsaXplXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChwYXRoKTtcbiAgY29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG4gIGlmIChsZW4gPT09IDApIHJldHVybiBcIi5cIjtcbiAgbGV0IHJvb3RFbmQgPSAwO1xuICBsZXQgZGV2aWNlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGxldCBpc0Fic29sdXRlID0gZmFsc2U7XG4gIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cbiAgLy8gVHJ5IHRvIG1hdGNoIGEgcm9vdFxuICBpZiAobGVuID4gMSkge1xuICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIFVOQyByb290XG5cbiAgICAgIC8vIElmIHdlIHN0YXJ0ZWQgd2l0aCBhIHNlcGFyYXRvciwgd2Uga25vdyB3ZSBhdCBsZWFzdCBoYXZlIGFuIGFic29sdXRlXG4gICAgICAvLyBwYXRoIG9mIHNvbWUga2luZCAoVU5DIG9yIG90aGVyd2lzZSlcbiAgICAgIGlzQWJzb2x1dGUgPSB0cnVlO1xuXG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgxKSkpIHtcbiAgICAgICAgLy8gTWF0Y2hlZCBkb3VibGUgcGF0aCBzZXBhcmF0b3IgYXQgYmVnaW5uaW5nXG4gICAgICAgIGxldCBqID0gMjtcbiAgICAgICAgbGV0IGxhc3QgPSBqO1xuICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG4gICAgICAgICAgY29uc3QgZmlyc3RQYXJ0ID0gcGF0aC5zbGljZShsYXN0LCBqKTtcbiAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgIGxhc3QgPSBqO1xuICAgICAgICAgIC8vIE1hdGNoIDEgb3IgbW9yZSBwYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgICBpZiAoIWlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuICAgICAgICAgICAgLy8gTWF0Y2hlZCFcbiAgICAgICAgICAgIGxhc3QgPSBqO1xuICAgICAgICAgICAgLy8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgICAgIGZvciAoOyBqIDwgbGVuOyArK2opIHtcbiAgICAgICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChqID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCBhIFVOQyByb290IG9ubHlcbiAgICAgICAgICAgICAgLy8gUmV0dXJuIHRoZSBub3JtYWxpemVkIHZlcnNpb24gb2YgdGhlIFVOQyByb290IHNpbmNlIHRoZXJlXG4gICAgICAgICAgICAgIC8vIGlzIG5vdGhpbmcgbGVmdCB0byBwcm9jZXNzXG5cbiAgICAgICAgICAgICAgcmV0dXJuIGBcXFxcXFxcXCR7Zmlyc3RQYXJ0fVxcXFwke3BhdGguc2xpY2UobGFzdCl9XFxcXGA7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCBhIFVOQyByb290IHdpdGggbGVmdG92ZXJzXG5cbiAgICAgICAgICAgICAgZGV2aWNlID0gYFxcXFxcXFxcJHtmaXJzdFBhcnR9XFxcXCR7cGF0aC5zbGljZShsYXN0LCBqKX1gO1xuICAgICAgICAgICAgICByb290RW5kID0gajtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJvb3RFbmQgPSAxO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaW5kb3dzRGV2aWNlUm9vdChjb2RlKSkge1xuICAgICAgLy8gUG9zc2libGUgZGV2aWNlIHJvb3RcblxuICAgICAgaWYgKHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTikge1xuICAgICAgICBkZXZpY2UgPSBwYXRoLnNsaWNlKDAsIDIpO1xuICAgICAgICByb290RW5kID0gMjtcbiAgICAgICAgaWYgKGxlbiA+IDIpIHtcbiAgICAgICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgyKSkpIHtcbiAgICAgICAgICAgIC8vIFRyZWF0IHNlcGFyYXRvciBmb2xsb3dpbmcgZHJpdmUgbmFtZSBhcyBhbiBhYnNvbHV0ZSBwYXRoXG4gICAgICAgICAgICAvLyBpbmRpY2F0b3JcbiAgICAgICAgICAgIGlzQWJzb2x1dGUgPSB0cnVlO1xuICAgICAgICAgICAgcm9vdEVuZCA9IDM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuICAgIC8vIGBwYXRoYCBjb250YWlucyBqdXN0IGEgcGF0aCBzZXBhcmF0b3IsIGV4aXQgZWFybHkgdG8gYXZvaWQgdW5uZWNlc3NhcnlcbiAgICAvLyB3b3JrXG4gICAgcmV0dXJuIFwiXFxcXFwiO1xuICB9XG5cbiAgbGV0IHRhaWw6IHN0cmluZztcbiAgaWYgKHJvb3RFbmQgPCBsZW4pIHtcbiAgICB0YWlsID0gbm9ybWFsaXplU3RyaW5nKFxuICAgICAgcGF0aC5zbGljZShyb290RW5kKSxcbiAgICAgICFpc0Fic29sdXRlLFxuICAgICAgXCJcXFxcXCIsXG4gICAgICBpc1BhdGhTZXBhcmF0b3IsXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICB0YWlsID0gXCJcIjtcbiAgfVxuICBpZiAodGFpbC5sZW5ndGggPT09IDAgJiYgIWlzQWJzb2x1dGUpIHRhaWwgPSBcIi5cIjtcbiAgaWYgKHRhaWwubGVuZ3RoID4gMCAmJiBpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGxlbiAtIDEpKSkge1xuICAgIHRhaWwgKz0gXCJcXFxcXCI7XG4gIH1cbiAgaWYgKGRldmljZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKGlzQWJzb2x1dGUpIHtcbiAgICAgIGlmICh0YWlsLmxlbmd0aCA+IDApIHJldHVybiBgXFxcXCR7dGFpbH1gO1xuICAgICAgZWxzZSByZXR1cm4gXCJcXFxcXCI7XG4gICAgfSBlbHNlIGlmICh0YWlsLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0YWlsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gXCJcIjtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNBYnNvbHV0ZSkge1xuICAgIGlmICh0YWlsLmxlbmd0aCA+IDApIHJldHVybiBgJHtkZXZpY2V9XFxcXCR7dGFpbH1gO1xuICAgIGVsc2UgcmV0dXJuIGAke2RldmljZX1cXFxcYDtcbiAgfSBlbHNlIGlmICh0YWlsLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gZGV2aWNlICsgdGFpbDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZGV2aWNlO1xuICB9XG59XG5cbi8qKlxuICogVmVyaWZpZXMgd2hldGhlciBwYXRoIGlzIGFic29sdXRlXG4gKiBAcGFyYW0gcGF0aCB0byB2ZXJpZnlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQWJzb2x1dGUocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGFzc2VydFBhdGgocGF0aCk7XG4gIGNvbnN0IGxlbiA9IHBhdGgubGVuZ3RoO1xuICBpZiAobGVuID09PSAwKSByZXR1cm4gZmFsc2U7XG5cbiAgY29uc3QgY29kZSA9IHBhdGguY2hhckNvZGVBdCgwKTtcbiAgaWYgKGlzUGF0aFNlcGFyYXRvcihjb2RlKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QoY29kZSkpIHtcbiAgICAvLyBQb3NzaWJsZSBkZXZpY2Ugcm9vdFxuXG4gICAgaWYgKGxlbiA+IDIgJiYgcGF0aC5jaGFyQ29kZUF0KDEpID09PSBDSEFSX0NPTE9OKSB7XG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgyKSkpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogSm9pbiBhbGwgZ2l2ZW4gYSBzZXF1ZW5jZSBvZiBgcGF0aHNgLHRoZW4gbm9ybWFsaXplcyB0aGUgcmVzdWx0aW5nIHBhdGguXG4gKiBAcGFyYW0gcGF0aHMgdG8gYmUgam9pbmVkIGFuZCBub3JtYWxpemVkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBqb2luKC4uLnBhdGhzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGNvbnN0IHBhdGhzQ291bnQgPSBwYXRocy5sZW5ndGg7XG4gIGlmIChwYXRoc0NvdW50ID09PSAwKSByZXR1cm4gXCIuXCI7XG5cbiAgbGV0IGpvaW5lZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBsZXQgZmlyc3RQYXJ0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoc0NvdW50OyArK2kpIHtcbiAgICBjb25zdCBwYXRoID0gcGF0aHNbaV07XG4gICAgYXNzZXJ0UGF0aChwYXRoKTtcbiAgICBpZiAocGF0aC5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoam9pbmVkID09PSB1bmRlZmluZWQpIGpvaW5lZCA9IGZpcnN0UGFydCA9IHBhdGg7XG4gICAgICBlbHNlIGpvaW5lZCArPSBgXFxcXCR7cGF0aH1gO1xuICAgIH1cbiAgfVxuXG4gIGlmIChqb2luZWQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIFwiLlwiO1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBqb2luZWQgcGF0aCBkb2Vzbid0IHN0YXJ0IHdpdGggdHdvIHNsYXNoZXMsIGJlY2F1c2VcbiAgLy8gbm9ybWFsaXplKCkgd2lsbCBtaXN0YWtlIGl0IGZvciBhbiBVTkMgcGF0aCB0aGVuLlxuICAvL1xuICAvLyBUaGlzIHN0ZXAgaXMgc2tpcHBlZCB3aGVuIGl0IGlzIHZlcnkgY2xlYXIgdGhhdCB0aGUgdXNlciBhY3R1YWxseVxuICAvLyBpbnRlbmRlZCB0byBwb2ludCBhdCBhbiBVTkMgcGF0aC4gVGhpcyBpcyBhc3N1bWVkIHdoZW4gdGhlIGZpcnN0XG4gIC8vIG5vbi1lbXB0eSBzdHJpbmcgYXJndW1lbnRzIHN0YXJ0cyB3aXRoIGV4YWN0bHkgdHdvIHNsYXNoZXMgZm9sbG93ZWQgYnlcbiAgLy8gYXQgbGVhc3Qgb25lIG1vcmUgbm9uLXNsYXNoIGNoYXJhY3Rlci5cbiAgLy9cbiAgLy8gTm90ZSB0aGF0IGZvciBub3JtYWxpemUoKSB0byB0cmVhdCBhIHBhdGggYXMgYW4gVU5DIHBhdGggaXQgbmVlZHMgdG9cbiAgLy8gaGF2ZSBhdCBsZWFzdCAyIGNvbXBvbmVudHMsIHNvIHdlIGRvbid0IGZpbHRlciBmb3IgdGhhdCBoZXJlLlxuICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlIHVzZXIgY2FuIHVzZSBqb2luIHRvIGNvbnN0cnVjdCBVTkMgcGF0aHMgZnJvbVxuICAvLyBhIHNlcnZlciBuYW1lIGFuZCBhIHNoYXJlIG5hbWU7IGZvciBleGFtcGxlOlxuICAvLyAgIHBhdGguam9pbignLy9zZXJ2ZXInLCAnc2hhcmUnKSAtPiAnXFxcXFxcXFxzZXJ2ZXJcXFxcc2hhcmVcXFxcJylcbiAgbGV0IG5lZWRzUmVwbGFjZSA9IHRydWU7XG4gIGxldCBzbGFzaENvdW50ID0gMDtcbiAgYXNzZXJ0KGZpcnN0UGFydCAhPSBudWxsKTtcbiAgaWYgKGlzUGF0aFNlcGFyYXRvcihmaXJzdFBhcnQuY2hhckNvZGVBdCgwKSkpIHtcbiAgICArK3NsYXNoQ291bnQ7XG4gICAgY29uc3QgZmlyc3RMZW4gPSBmaXJzdFBhcnQubGVuZ3RoO1xuICAgIGlmIChmaXJzdExlbiA+IDEpIHtcbiAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoZmlyc3RQYXJ0LmNoYXJDb2RlQXQoMSkpKSB7XG4gICAgICAgICsrc2xhc2hDb3VudDtcbiAgICAgICAgaWYgKGZpcnN0TGVuID4gMikge1xuICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoZmlyc3RQYXJ0LmNoYXJDb2RlQXQoMikpKSArK3NsYXNoQ291bnQ7XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBXZSBtYXRjaGVkIGEgVU5DIHBhdGggaW4gdGhlIGZpcnN0IHBhcnRcbiAgICAgICAgICAgIG5lZWRzUmVwbGFjZSA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAobmVlZHNSZXBsYWNlKSB7XG4gICAgLy8gRmluZCBhbnkgbW9yZSBjb25zZWN1dGl2ZSBzbGFzaGVzIHdlIG5lZWQgdG8gcmVwbGFjZVxuICAgIGZvciAoOyBzbGFzaENvdW50IDwgam9pbmVkLmxlbmd0aDsgKytzbGFzaENvdW50KSB7XG4gICAgICBpZiAoIWlzUGF0aFNlcGFyYXRvcihqb2luZWQuY2hhckNvZGVBdChzbGFzaENvdW50KSkpIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFJlcGxhY2UgdGhlIHNsYXNoZXMgaWYgbmVlZGVkXG4gICAgaWYgKHNsYXNoQ291bnQgPj0gMikgam9pbmVkID0gYFxcXFwke2pvaW5lZC5zbGljZShzbGFzaENvdW50KX1gO1xuICB9XG5cbiAgcmV0dXJuIG5vcm1hbGl6ZShqb2luZWQpO1xufVxuXG4vKipcbiAqIEl0IHdpbGwgc29sdmUgdGhlIHJlbGF0aXZlIHBhdGggZnJvbSBgZnJvbWAgdG8gYHRvYCwgZm9yIGluc3RhbmNlOlxuICogIGZyb20gPSAnQzpcXFxcb3JhbmRlYVxcXFx0ZXN0XFxcXGFhYSdcbiAqICB0byA9ICdDOlxcXFxvcmFuZGVhXFxcXGltcGxcXFxcYmJiJ1xuICogVGhlIG91dHB1dCBvZiB0aGUgZnVuY3Rpb24gc2hvdWxkIGJlOiAnLi5cXFxcLi5cXFxcaW1wbFxcXFxiYmInXG4gKiBAcGFyYW0gZnJvbSByZWxhdGl2ZSBwYXRoXG4gKiBAcGFyYW0gdG8gcmVsYXRpdmUgcGF0aFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmUoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChmcm9tKTtcbiAgYXNzZXJ0UGF0aCh0byk7XG5cbiAgaWYgKGZyb20gPT09IHRvKSByZXR1cm4gXCJcIjtcblxuICBjb25zdCBmcm9tT3JpZyA9IHJlc29sdmUoZnJvbSk7XG4gIGNvbnN0IHRvT3JpZyA9IHJlc29sdmUodG8pO1xuXG4gIGlmIChmcm9tT3JpZyA9PT0gdG9PcmlnKSByZXR1cm4gXCJcIjtcblxuICBmcm9tID0gZnJvbU9yaWcudG9Mb3dlckNhc2UoKTtcbiAgdG8gPSB0b09yaWcudG9Mb3dlckNhc2UoKTtcblxuICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiBcIlwiO1xuXG4gIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgbGV0IGZyb21TdGFydCA9IDA7XG4gIGxldCBmcm9tRW5kID0gZnJvbS5sZW5ndGg7XG4gIGZvciAoOyBmcm9tU3RhcnQgPCBmcm9tRW5kOyArK2Zyb21TdGFydCkge1xuICAgIGlmIChmcm9tLmNoYXJDb2RlQXQoZnJvbVN0YXJ0KSAhPT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgLy8gVHJpbSB0cmFpbGluZyBiYWNrc2xhc2hlcyAoYXBwbGljYWJsZSB0byBVTkMgcGF0aHMgb25seSlcbiAgZm9yICg7IGZyb21FbmQgLSAxID4gZnJvbVN0YXJ0OyAtLWZyb21FbmQpIHtcbiAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21FbmQgLSAxKSAhPT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgY29uc3QgZnJvbUxlbiA9IGZyb21FbmQgLSBmcm9tU3RhcnQ7XG5cbiAgLy8gVHJpbSBhbnkgbGVhZGluZyBiYWNrc2xhc2hlc1xuICBsZXQgdG9TdGFydCA9IDA7XG4gIGxldCB0b0VuZCA9IHRvLmxlbmd0aDtcbiAgZm9yICg7IHRvU3RhcnQgPCB0b0VuZDsgKyt0b1N0YXJ0KSB7XG4gICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCkgIT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIGJyZWFrO1xuICB9XG4gIC8vIFRyaW0gdHJhaWxpbmcgYmFja3NsYXNoZXMgKGFwcGxpY2FibGUgdG8gVU5DIHBhdGhzIG9ubHkpXG4gIGZvciAoOyB0b0VuZCAtIDEgPiB0b1N0YXJ0OyAtLXRvRW5kKSB7XG4gICAgaWYgKHRvLmNoYXJDb2RlQXQodG9FbmQgLSAxKSAhPT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgY29uc3QgdG9MZW4gPSB0b0VuZCAtIHRvU3RhcnQ7XG5cbiAgLy8gQ29tcGFyZSBwYXRocyB0byBmaW5kIHRoZSBsb25nZXN0IGNvbW1vbiBwYXRoIGZyb20gcm9vdFxuICBjb25zdCBsZW5ndGggPSBmcm9tTGVuIDwgdG9MZW4gPyBmcm9tTGVuIDogdG9MZW47XG4gIGxldCBsYXN0Q29tbW9uU2VwID0gLTE7XG4gIGxldCBpID0gMDtcbiAgZm9yICg7IGkgPD0gbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoaSA9PT0gbGVuZ3RoKSB7XG4gICAgICBpZiAodG9MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCArIGkpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG4gICAgICAgICAgLy8gV2UgZ2V0IGhlcmUgaWYgYGZyb21gIGlzIHRoZSBleGFjdCBiYXNlIHBhdGggZm9yIGB0b2AuXG4gICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209J0M6XFxcXGZvb1xcXFxiYXInOyB0bz0nQzpcXFxcZm9vXFxcXGJhclxcXFxiYXonXG4gICAgICAgICAgcmV0dXJuIHRvT3JpZy5zbGljZSh0b1N0YXJ0ICsgaSArIDEpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDIpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGRldmljZSByb290LlxuICAgICAgICAgIC8vIEZvciBleGFtcGxlOiBmcm9tPSdDOlxcXFwnOyB0bz0nQzpcXFxcZm9vJ1xuICAgICAgICAgIHJldHVybiB0b09yaWcuc2xpY2UodG9TdGFydCArIGkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZnJvbUxlbiA+IGxlbmd0aCkge1xuICAgICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG4gICAgICAgICAgLy8gV2UgZ2V0IGhlcmUgaWYgYHRvYCBpcyB0aGUgZXhhY3QgYmFzZSBwYXRoIGZvciBgZnJvbWAuXG4gICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209J0M6XFxcXGZvb1xcXFxiYXInOyB0bz0nQzpcXFxcZm9vJ1xuICAgICAgICAgIGxhc3RDb21tb25TZXAgPSBpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDIpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSBkZXZpY2Ugcm9vdC5cbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nQzpcXFxcZm9vXFxcXGJhcic7IHRvPSdDOlxcXFwnXG4gICAgICAgICAgbGFzdENvbW1vblNlcCA9IDM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBmcm9tQ29kZSA9IGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQgKyBpKTtcbiAgICBjb25zdCB0b0NvZGUgPSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKTtcbiAgICBpZiAoZnJvbUNvZGUgIT09IHRvQ29kZSkgYnJlYWs7XG4gICAgZWxzZSBpZiAoZnJvbUNvZGUgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIGxhc3RDb21tb25TZXAgPSBpO1xuICB9XG5cbiAgLy8gV2UgZm91bmQgYSBtaXNtYXRjaCBiZWZvcmUgdGhlIGZpcnN0IGNvbW1vbiBwYXRoIHNlcGFyYXRvciB3YXMgc2Vlbiwgc29cbiAgLy8gcmV0dXJuIHRoZSBvcmlnaW5hbCBgdG9gLlxuICBpZiAoaSAhPT0gbGVuZ3RoICYmIGxhc3RDb21tb25TZXAgPT09IC0xKSB7XG4gICAgcmV0dXJuIHRvT3JpZztcbiAgfVxuXG4gIGxldCBvdXQgPSBcIlwiO1xuICBpZiAobGFzdENvbW1vblNlcCA9PT0gLTEpIGxhc3RDb21tb25TZXAgPSAwO1xuICAvLyBHZW5lcmF0ZSB0aGUgcmVsYXRpdmUgcGF0aCBiYXNlZCBvbiB0aGUgcGF0aCBkaWZmZXJlbmNlIGJldHdlZW4gYHRvYCBhbmRcbiAgLy8gYGZyb21gXG4gIGZvciAoaSA9IGZyb21TdGFydCArIGxhc3RDb21tb25TZXAgKyAxOyBpIDw9IGZyb21FbmQ7ICsraSkge1xuICAgIGlmIChpID09PSBmcm9tRW5kIHx8IGZyb20uY2hhckNvZGVBdChpKSA9PT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkge1xuICAgICAgaWYgKG91dC5sZW5ndGggPT09IDApIG91dCArPSBcIi4uXCI7XG4gICAgICBlbHNlIG91dCArPSBcIlxcXFwuLlwiO1xuICAgIH1cbiAgfVxuXG4gIC8vIExhc3RseSwgYXBwZW5kIHRoZSByZXN0IG9mIHRoZSBkZXN0aW5hdGlvbiAoYHRvYCkgcGF0aCB0aGF0IGNvbWVzIGFmdGVyXG4gIC8vIHRoZSBjb21tb24gcGF0aCBwYXJ0c1xuICBpZiAob3V0Lmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4gb3V0ICsgdG9PcmlnLnNsaWNlKHRvU3RhcnQgKyBsYXN0Q29tbW9uU2VwLCB0b0VuZCk7XG4gIH0gZWxzZSB7XG4gICAgdG9TdGFydCArPSBsYXN0Q29tbW9uU2VwO1xuICAgIGlmICh0b09yaWcuY2hhckNvZGVBdCh0b1N0YXJ0KSA9PT0gQ0hBUl9CQUNLV0FSRF9TTEFTSCkgKyt0b1N0YXJ0O1xuICAgIHJldHVybiB0b09yaWcuc2xpY2UodG9TdGFydCwgdG9FbmQpO1xuICB9XG59XG5cbi8qKlxuICogUmVzb2x2ZXMgcGF0aCB0byBhIG5hbWVzcGFjZSBwYXRoXG4gKiBAcGFyYW0gcGF0aCB0byByZXNvbHZlIHRvIG5hbWVzcGFjZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9OYW1lc3BhY2VkUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBOb3RlOiB0aGlzIHdpbGwgKnByb2JhYmx5KiB0aHJvdyBzb21ld2hlcmUuXG4gIGlmICh0eXBlb2YgcGF0aCAhPT0gXCJzdHJpbmdcIikgcmV0dXJuIHBhdGg7XG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiXCI7XG5cbiAgY29uc3QgcmVzb2x2ZWRQYXRoID0gcmVzb2x2ZShwYXRoKTtcblxuICBpZiAocmVzb2x2ZWRQYXRoLmxlbmd0aCA+PSAzKSB7XG4gICAgaWYgKHJlc29sdmVkUGF0aC5jaGFyQ29kZUF0KDApID09PSBDSEFSX0JBQ0tXQVJEX1NMQVNIKSB7XG4gICAgICAvLyBQb3NzaWJsZSBVTkMgcm9vdFxuXG4gICAgICBpZiAocmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQkFDS1dBUkRfU0xBU0gpIHtcbiAgICAgICAgY29uc3QgY29kZSA9IHJlc29sdmVkUGF0aC5jaGFyQ29kZUF0KDIpO1xuICAgICAgICBpZiAoY29kZSAhPT0gQ0hBUl9RVUVTVElPTl9NQVJLICYmIGNvZGUgIT09IENIQVJfRE9UKSB7XG4gICAgICAgICAgLy8gTWF0Y2hlZCBub24tbG9uZyBVTkMgcm9vdCwgY29udmVydCB0aGUgcGF0aCB0byBhIGxvbmcgVU5DIHBhdGhcbiAgICAgICAgICByZXR1cm4gYFxcXFxcXFxcP1xcXFxVTkNcXFxcJHtyZXNvbHZlZFBhdGguc2xpY2UoMil9YDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaW5kb3dzRGV2aWNlUm9vdChyZXNvbHZlZFBhdGguY2hhckNvZGVBdCgwKSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIGRldmljZSByb290XG5cbiAgICAgIGlmIChcbiAgICAgICAgcmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04gJiZcbiAgICAgICAgcmVzb2x2ZWRQYXRoLmNoYXJDb2RlQXQoMikgPT09IENIQVJfQkFDS1dBUkRfU0xBU0hcbiAgICAgICkge1xuICAgICAgICAvLyBNYXRjaGVkIGRldmljZSByb290LCBjb252ZXJ0IHRoZSBwYXRoIHRvIGEgbG9uZyBVTkMgcGF0aFxuICAgICAgICByZXR1cm4gYFxcXFxcXFxcP1xcXFwke3Jlc29sdmVkUGF0aH1gO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXRoO1xufVxuXG4vKipcbiAqIFJldHVybiB0aGUgZGlyZWN0b3J5IG5hbWUgb2YgYSBgcGF0aGAuXG4gKiBAcGFyYW0gcGF0aCB0byBkZXRlcm1pbmUgbmFtZSBmb3JcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpcm5hbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChwYXRoKTtcbiAgY29uc3QgbGVuID0gcGF0aC5sZW5ndGg7XG4gIGlmIChsZW4gPT09IDApIHJldHVybiBcIi5cIjtcbiAgbGV0IHJvb3RFbmQgPSAtMTtcbiAgbGV0IGVuZCA9IC0xO1xuICBsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgbGV0IG9mZnNldCA9IDA7XG4gIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cbiAgLy8gVHJ5IHRvIG1hdGNoIGEgcm9vdFxuICBpZiAobGVuID4gMSkge1xuICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIFVOQyByb290XG5cbiAgICAgIHJvb3RFbmQgPSBvZmZzZXQgPSAxO1xuXG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdCgxKSkpIHtcbiAgICAgICAgLy8gTWF0Y2hlZCBkb3VibGUgcGF0aCBzZXBhcmF0b3IgYXQgYmVnaW5uaW5nXG4gICAgICAgIGxldCBqID0gMjtcbiAgICAgICAgbGV0IGxhc3QgPSBqO1xuICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaikpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG4gICAgICAgICAgLy8gTWF0Y2hlZCFcbiAgICAgICAgICBsYXN0ID0gajtcbiAgICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgcGF0aCBzZXBhcmF0b3JzXG4gICAgICAgICAgZm9yICg7IGogPCBsZW47ICsraikge1xuICAgICAgICAgICAgaWYgKCFpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChqIDwgbGVuICYmIGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgIC8vIE1hdGNoZWQhXG4gICAgICAgICAgICBsYXN0ID0gajtcbiAgICAgICAgICAgIC8vIE1hdGNoIDEgb3IgbW9yZSBub24tcGF0aCBzZXBhcmF0b3JzXG4gICAgICAgICAgICBmb3IgKDsgaiA8IGxlbjsgKytqKSB7XG4gICAgICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaiA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgIC8vIFdlIG1hdGNoZWQgYSBVTkMgcm9vdCBvbmx5XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGogIT09IGxhc3QpIHtcbiAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCBhIFVOQyByb290IHdpdGggbGVmdG92ZXJzXG5cbiAgICAgICAgICAgICAgLy8gT2Zmc2V0IGJ5IDEgdG8gaW5jbHVkZSB0aGUgc2VwYXJhdG9yIGFmdGVyIHRoZSBVTkMgcm9vdCB0b1xuICAgICAgICAgICAgICAvLyB0cmVhdCBpdCBhcyBhIFwibm9ybWFsIHJvb3RcIiBvbiB0b3Agb2YgYSAoVU5DKSByb290XG4gICAgICAgICAgICAgIHJvb3RFbmQgPSBvZmZzZXQgPSBqICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIGRldmljZSByb290XG5cbiAgICAgIGlmIChwYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04pIHtcbiAgICAgICAgcm9vdEVuZCA9IG9mZnNldCA9IDI7XG4gICAgICAgIGlmIChsZW4gPiAyKSB7XG4gICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMikpKSByb290RW5kID0gb2Zmc2V0ID0gMztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIHBhdGggc2VwYXJhdG9yLCBleGl0IGVhcmx5IHRvIGF2b2lkXG4gICAgLy8gdW5uZWNlc3Nhcnkgd29ya1xuICAgIHJldHVybiBwYXRoO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IGxlbiAtIDE7IGkgPj0gb2Zmc2V0OyAtLWkpIHtcbiAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChpKSkpIHtcbiAgICAgIGlmICghbWF0Y2hlZFNsYXNoKSB7XG4gICAgICAgIGVuZCA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvclxuICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICBpZiAocm9vdEVuZCA9PT0gLTEpIHJldHVybiBcIi5cIjtcbiAgICBlbHNlIGVuZCA9IHJvb3RFbmQ7XG4gIH1cbiAgcmV0dXJuIHBhdGguc2xpY2UoMCwgZW5kKTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGxhc3QgcG9ydGlvbiBvZiBhIGBwYXRoYC4gVHJhaWxpbmcgZGlyZWN0b3J5IHNlcGFyYXRvcnMgYXJlIGlnbm9yZWQuXG4gKiBAcGFyYW0gcGF0aCB0byBwcm9jZXNzXG4gKiBAcGFyYW0gZXh0IG9mIHBhdGggZGlyZWN0b3J5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlbmFtZShwYXRoOiBzdHJpbmcsIGV4dCA9IFwiXCIpOiBzdHJpbmcge1xuICBpZiAoZXh0ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGV4dCAhPT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiZXh0XCIgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZycpO1xuICB9XG5cbiAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICBsZXQgc3RhcnQgPSAwO1xuICBsZXQgZW5kID0gLTE7XG4gIGxldCBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICBsZXQgaTogbnVtYmVyO1xuXG4gIC8vIENoZWNrIGZvciBhIGRyaXZlIGxldHRlciBwcmVmaXggc28gYXMgbm90IHRvIG1pc3Rha2UgdGhlIGZvbGxvd2luZ1xuICAvLyBwYXRoIHNlcGFyYXRvciBhcyBhbiBleHRyYSBzZXBhcmF0b3IgYXQgdGhlIGVuZCBvZiB0aGUgcGF0aCB0aGF0IGNhbiBiZVxuICAvLyBkaXNyZWdhcmRlZFxuICBpZiAocGF0aC5sZW5ndGggPj0gMikge1xuICAgIGNvbnN0IGRyaXZlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuICAgIGlmIChpc1dpbmRvd3NEZXZpY2VSb290KGRyaXZlKSkge1xuICAgICAgaWYgKHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTikgc3RhcnQgPSAyO1xuICAgIH1cbiAgfVxuXG4gIGlmIChleHQgIT09IHVuZGVmaW5lZCAmJiBleHQubGVuZ3RoID4gMCAmJiBleHQubGVuZ3RoIDw9IHBhdGgubGVuZ3RoKSB7XG4gICAgaWYgKGV4dC5sZW5ndGggPT09IHBhdGgubGVuZ3RoICYmIGV4dCA9PT0gcGF0aCkgcmV0dXJuIFwiXCI7XG4gICAgbGV0IGV4dElkeCA9IGV4dC5sZW5ndGggLSAxO1xuICAgIGxldCBmaXJzdE5vblNsYXNoRW5kID0gLTE7XG4gICAgZm9yIChpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IHN0YXJ0OyAtLWkpIHtcbiAgICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmaXJzdE5vblNsYXNoRW5kID09PSAtMSkge1xuICAgICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCByZW1lbWJlciB0aGlzIGluZGV4IGluIGNhc2VcbiAgICAgICAgICAvLyB3ZSBuZWVkIGl0IGlmIHRoZSBleHRlbnNpb24gZW5kcyB1cCBub3QgbWF0Y2hpbmdcbiAgICAgICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgICAgICBmaXJzdE5vblNsYXNoRW5kID0gaSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4dElkeCA+PSAwKSB7XG4gICAgICAgICAgLy8gVHJ5IHRvIG1hdGNoIHRoZSBleHBsaWNpdCBleHRlbnNpb25cbiAgICAgICAgICBpZiAoY29kZSA9PT0gZXh0LmNoYXJDb2RlQXQoZXh0SWR4KSkge1xuICAgICAgICAgICAgaWYgKC0tZXh0SWR4ID09PSAtMSkge1xuICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIHRoZSBleHRlbnNpb24sIHNvIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91ciBwYXRoXG4gICAgICAgICAgICAgIC8vIGNvbXBvbmVudFxuICAgICAgICAgICAgICBlbmQgPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFeHRlbnNpb24gZG9lcyBub3QgbWF0Y2gsIHNvIG91ciByZXN1bHQgaXMgdGhlIGVudGlyZSBwYXRoXG4gICAgICAgICAgICAvLyBjb21wb25lbnRcbiAgICAgICAgICAgIGV4dElkeCA9IC0xO1xuICAgICAgICAgICAgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPT09IGVuZCkgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICBlbHNlIGlmIChlbmQgPT09IC0xKSBlbmQgPSBwYXRoLmxlbmd0aDtcbiAgICByZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gc3RhcnQ7IC0taSkge1xuICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoaSkpKSB7XG4gICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZW5kID09PSAtMSkge1xuICAgICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG4gICAgICAgIC8vIHBhdGggY29tcG9uZW50XG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZW5kID09PSAtMSkgcmV0dXJuIFwiXCI7XG4gICAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnQsIGVuZCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGV4dGVuc2lvbiBvZiB0aGUgYHBhdGhgIHdpdGggbGVhZGluZyBwZXJpb2QuXG4gKiBAcGFyYW0gcGF0aCB3aXRoIGV4dGVuc2lvblxuICogQHJldHVybnMgZXh0ZW5zaW9uIChleC4gZm9yIGBmaWxlLnRzYCByZXR1cm5zIGAudHNgKVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0bmFtZShwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBhc3NlcnRQYXRoKHBhdGgpO1xuICBsZXQgc3RhcnQgPSAwO1xuICBsZXQgc3RhcnREb3QgPSAtMTtcbiAgbGV0IHN0YXJ0UGFydCA9IDA7XG4gIGxldCBlbmQgPSAtMTtcbiAgbGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG4gIC8vIFRyYWNrIHRoZSBzdGF0ZSBvZiBjaGFyYWN0ZXJzIChpZiBhbnkpIHdlIHNlZSBiZWZvcmUgb3VyIGZpcnN0IGRvdCBhbmRcbiAgLy8gYWZ0ZXIgYW55IHBhdGggc2VwYXJhdG9yIHdlIGZpbmRcbiAgbGV0IHByZURvdFN0YXRlID0gMDtcblxuICAvLyBDaGVjayBmb3IgYSBkcml2ZSBsZXR0ZXIgcHJlZml4IHNvIGFzIG5vdCB0byBtaXN0YWtlIHRoZSBmb2xsb3dpbmdcbiAgLy8gcGF0aCBzZXBhcmF0b3IgYXMgYW4gZXh0cmEgc2VwYXJhdG9yIGF0IHRoZSBlbmQgb2YgdGhlIHBhdGggdGhhdCBjYW4gYmVcbiAgLy8gZGlzcmVnYXJkZWRcblxuICBpZiAoXG4gICAgcGF0aC5sZW5ndGggPj0gMiAmJlxuICAgIHBhdGguY2hhckNvZGVBdCgxKSA9PT0gQ0hBUl9DT0xPTiAmJlxuICAgIGlzV2luZG93c0RldmljZVJvb3QocGF0aC5jaGFyQ29kZUF0KDApKVxuICApIHtcbiAgICBzdGFydCA9IHN0YXJ0UGFydCA9IDI7XG4gIH1cblxuICBmb3IgKGxldCBpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IHN0YXJ0OyAtLWkpIHtcbiAgICBjb25zdCBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgIGlmICghbWF0Y2hlZFNsYXNoKSB7XG4gICAgICAgIHN0YXJ0UGFydCA9IGkgKyAxO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoZW5kID09PSAtMSkge1xuICAgICAgLy8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3IsIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91clxuICAgICAgLy8gZXh0ZW5zaW9uXG4gICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgIGVuZCA9IGkgKyAxO1xuICAgIH1cbiAgICBpZiAoY29kZSA9PT0gQ0hBUl9ET1QpIHtcbiAgICAgIC8vIElmIHRoaXMgaXMgb3VyIGZpcnN0IGRvdCwgbWFyayBpdCBhcyB0aGUgc3RhcnQgb2Ygb3VyIGV4dGVuc2lvblxuICAgICAgaWYgKHN0YXJ0RG90ID09PSAtMSkgc3RhcnREb3QgPSBpO1xuICAgICAgZWxzZSBpZiAocHJlRG90U3RhdGUgIT09IDEpIHByZURvdFN0YXRlID0gMTtcbiAgICB9IGVsc2UgaWYgKHN0YXJ0RG90ICE9PSAtMSkge1xuICAgICAgLy8gV2Ugc2F3IGEgbm9uLWRvdCBhbmQgbm9uLXBhdGggc2VwYXJhdG9yIGJlZm9yZSBvdXIgZG90LCBzbyB3ZSBzaG91bGRcbiAgICAgIC8vIGhhdmUgYSBnb29kIGNoYW5jZSBhdCBoYXZpbmcgYSBub24tZW1wdHkgZXh0ZW5zaW9uXG4gICAgICBwcmVEb3RTdGF0ZSA9IC0xO1xuICAgIH1cbiAgfVxuXG4gIGlmIChcbiAgICBzdGFydERvdCA9PT0gLTEgfHxcbiAgICBlbmQgPT09IC0xIHx8XG4gICAgLy8gV2Ugc2F3IGEgbm9uLWRvdCBjaGFyYWN0ZXIgaW1tZWRpYXRlbHkgYmVmb3JlIHRoZSBkb3RcbiAgICBwcmVEb3RTdGF0ZSA9PT0gMCB8fFxuICAgIC8vIFRoZSAocmlnaHQtbW9zdCkgdHJpbW1lZCBwYXRoIGNvbXBvbmVudCBpcyBleGFjdGx5ICcuLidcbiAgICAocHJlRG90U3RhdGUgPT09IDEgJiYgc3RhcnREb3QgPT09IGVuZCAtIDEgJiYgc3RhcnREb3QgPT09IHN0YXJ0UGFydCArIDEpXG4gICkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG4gIHJldHVybiBwYXRoLnNsaWNlKHN0YXJ0RG90LCBlbmQpO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIGEgcGF0aCBmcm9tIGBGb3JtYXRJbnB1dFBhdGhPYmplY3RgIG9iamVjdC5cbiAqIEBwYXJhbSBwYXRoT2JqZWN0IHdpdGggcGF0aFxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0KHBhdGhPYmplY3Q6IEZvcm1hdElucHV0UGF0aE9iamVjdCk6IHN0cmluZyB7XG4gIGlmIChwYXRoT2JqZWN0ID09PSBudWxsIHx8IHR5cGVvZiBwYXRoT2JqZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgIGBUaGUgXCJwYXRoT2JqZWN0XCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIE9iamVjdC4gUmVjZWl2ZWQgdHlwZSAke3R5cGVvZiBwYXRoT2JqZWN0fWAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gX2Zvcm1hdChcIlxcXFxcIiwgcGF0aE9iamVjdCk7XG59XG5cbi8qKlxuICogUmV0dXJuIGEgYFBhcnNlZFBhdGhgIG9iamVjdCBvZiB0aGUgYHBhdGhgLlxuICogQHBhcmFtIHBhdGggdG8gcHJvY2Vzc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2UocGF0aDogc3RyaW5nKTogUGFyc2VkUGF0aCB7XG4gIGFzc2VydFBhdGgocGF0aCk7XG5cbiAgY29uc3QgcmV0OiBQYXJzZWRQYXRoID0geyByb290OiBcIlwiLCBkaXI6IFwiXCIsIGJhc2U6IFwiXCIsIGV4dDogXCJcIiwgbmFtZTogXCJcIiB9O1xuXG4gIGNvbnN0IGxlbiA9IHBhdGgubGVuZ3RoO1xuICBpZiAobGVuID09PSAwKSByZXR1cm4gcmV0O1xuXG4gIGxldCByb290RW5kID0gMDtcbiAgbGV0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoMCk7XG5cbiAgLy8gVHJ5IHRvIG1hdGNoIGEgcm9vdFxuICBpZiAobGVuID4gMSkge1xuICAgIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIFVOQyByb290XG5cbiAgICAgIHJvb3RFbmQgPSAxO1xuICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMSkpKSB7XG4gICAgICAgIC8vIE1hdGNoZWQgZG91YmxlIHBhdGggc2VwYXJhdG9yIGF0IGJlZ2lubmluZ1xuICAgICAgICBsZXQgaiA9IDI7XG4gICAgICAgIGxldCBsYXN0ID0gajtcbiAgICAgICAgLy8gTWF0Y2ggMSBvciBtb3JlIG5vbi1wYXRoIHNlcGFyYXRvcnNcbiAgICAgICAgZm9yICg7IGogPCBsZW47ICsraikge1xuICAgICAgICAgIGlmIChpc1BhdGhTZXBhcmF0b3IocGF0aC5jaGFyQ29kZUF0KGopKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGogPCBsZW4gJiYgaiAhPT0gbGFzdCkge1xuICAgICAgICAgIC8vIE1hdGNoZWQhXG4gICAgICAgICAgbGFzdCA9IGo7XG4gICAgICAgICAgLy8gTWF0Y2ggMSBvciBtb3JlIHBhdGggc2VwYXJhdG9yc1xuICAgICAgICAgIGZvciAoOyBqIDwgbGVuOyArK2opIHtcbiAgICAgICAgICAgIGlmICghaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChqKSkpIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaiA8IGxlbiAmJiBqICE9PSBsYXN0KSB7XG4gICAgICAgICAgICAvLyBNYXRjaGVkIVxuICAgICAgICAgICAgbGFzdCA9IGo7XG4gICAgICAgICAgICAvLyBNYXRjaCAxIG9yIG1vcmUgbm9uLXBhdGggc2VwYXJhdG9yc1xuICAgICAgICAgICAgZm9yICg7IGogPCBsZW47ICsraikge1xuICAgICAgICAgICAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKHBhdGguY2hhckNvZGVBdChqKSkpIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGogPT09IGxlbikge1xuICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIGEgVU5DIHJvb3Qgb25seVxuXG4gICAgICAgICAgICAgIHJvb3RFbmQgPSBqO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChqICE9PSBsYXN0KSB7XG4gICAgICAgICAgICAgIC8vIFdlIG1hdGNoZWQgYSBVTkMgcm9vdCB3aXRoIGxlZnRvdmVyc1xuXG4gICAgICAgICAgICAgIHJvb3RFbmQgPSBqICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzV2luZG93c0RldmljZVJvb3QoY29kZSkpIHtcbiAgICAgIC8vIFBvc3NpYmxlIGRldmljZSByb290XG5cbiAgICAgIGlmIChwYXRoLmNoYXJDb2RlQXQoMSkgPT09IENIQVJfQ09MT04pIHtcbiAgICAgICAgcm9vdEVuZCA9IDI7XG4gICAgICAgIGlmIChsZW4gPiAyKSB7XG4gICAgICAgICAgaWYgKGlzUGF0aFNlcGFyYXRvcihwYXRoLmNoYXJDb2RlQXQoMikpKSB7XG4gICAgICAgICAgICBpZiAobGVuID09PSAzKSB7XG4gICAgICAgICAgICAgIC8vIGBwYXRoYCBjb250YWlucyBqdXN0IGEgZHJpdmUgcm9vdCwgZXhpdCBlYXJseSB0byBhdm9pZFxuICAgICAgICAgICAgICAvLyB1bm5lY2Vzc2FyeSB3b3JrXG4gICAgICAgICAgICAgIHJldC5yb290ID0gcmV0LmRpciA9IHBhdGg7XG4gICAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByb290RW5kID0gMztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gYHBhdGhgIGNvbnRhaW5zIGp1c3QgYSBkcml2ZSByb290LCBleGl0IGVhcmx5IHRvIGF2b2lkXG4gICAgICAgICAgLy8gdW5uZWNlc3Nhcnkgd29ya1xuICAgICAgICAgIHJldC5yb290ID0gcmV0LmRpciA9IHBhdGg7XG4gICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChpc1BhdGhTZXBhcmF0b3IoY29kZSkpIHtcbiAgICAvLyBgcGF0aGAgY29udGFpbnMganVzdCBhIHBhdGggc2VwYXJhdG9yLCBleGl0IGVhcmx5IHRvIGF2b2lkXG4gICAgLy8gdW5uZWNlc3Nhcnkgd29ya1xuICAgIHJldC5yb290ID0gcmV0LmRpciA9IHBhdGg7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIGlmIChyb290RW5kID4gMCkgcmV0LnJvb3QgPSBwYXRoLnNsaWNlKDAsIHJvb3RFbmQpO1xuXG4gIGxldCBzdGFydERvdCA9IC0xO1xuICBsZXQgc3RhcnRQYXJ0ID0gcm9vdEVuZDtcbiAgbGV0IGVuZCA9IC0xO1xuICBsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgbGV0IGkgPSBwYXRoLmxlbmd0aCAtIDE7XG5cbiAgLy8gVHJhY2sgdGhlIHN0YXRlIG9mIGNoYXJhY3RlcnMgKGlmIGFueSkgd2Ugc2VlIGJlZm9yZSBvdXIgZmlyc3QgZG90IGFuZFxuICAvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuICBsZXQgcHJlRG90U3RhdGUgPSAwO1xuXG4gIC8vIEdldCBub24tZGlyIGluZm9cbiAgZm9yICg7IGkgPj0gcm9vdEVuZDsgLS1pKSB7XG4gICAgY29kZSA9IHBhdGguY2hhckNvZGVBdChpKTtcbiAgICBpZiAoaXNQYXRoU2VwYXJhdG9yKGNvZGUpKSB7XG4gICAgICAvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICBzdGFydFBhcnQgPSBpICsgMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgIC8vIGV4dGVuc2lvblxuICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgICBlbmQgPSBpICsgMTtcbiAgICB9XG4gICAgaWYgKGNvZGUgPT09IENIQVJfRE9UKSB7XG4gICAgICAvLyBJZiB0aGlzIGlzIG91ciBmaXJzdCBkb3QsIG1hcmsgaXQgYXMgdGhlIHN0YXJ0IG9mIG91ciBleHRlbnNpb25cbiAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpIHN0YXJ0RG90ID0gaTtcbiAgICAgIGVsc2UgaWYgKHByZURvdFN0YXRlICE9PSAxKSBwcmVEb3RTdGF0ZSA9IDE7XG4gICAgfSBlbHNlIGlmIChzdGFydERvdCAhPT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgYW5kIG5vbi1wYXRoIHNlcGFyYXRvciBiZWZvcmUgb3VyIGRvdCwgc28gd2Ugc2hvdWxkXG4gICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgcHJlRG90U3RhdGUgPSAtMTtcbiAgICB9XG4gIH1cblxuICBpZiAoXG4gICAgc3RhcnREb3QgPT09IC0xIHx8XG4gICAgZW5kID09PSAtMSB8fFxuICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG4gICAgcHJlRG90U3RhdGUgPT09IDAgfHxcbiAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgKHByZURvdFN0YXRlID09PSAxICYmIHN0YXJ0RG90ID09PSBlbmQgLSAxICYmIHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKVxuICApIHtcbiAgICBpZiAoZW5kICE9PSAtMSkge1xuICAgICAgcmV0LmJhc2UgPSByZXQubmFtZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBlbmQpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXQubmFtZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBzdGFydERvdCk7XG4gICAgcmV0LmJhc2UgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgZW5kKTtcbiAgICByZXQuZXh0ID0gcGF0aC5zbGljZShzdGFydERvdCwgZW5kKTtcbiAgfVxuXG4gIC8vIElmIHRoZSBkaXJlY3RvcnkgaXMgdGhlIHJvb3QsIHVzZSB0aGUgZW50aXJlIHJvb3QgYXMgdGhlIGBkaXJgIGluY2x1ZGluZ1xuICAvLyB0aGUgdHJhaWxpbmcgc2xhc2ggaWYgYW55IChgQzpcXGFiY2AgLT4gYEM6XFxgKS4gT3RoZXJ3aXNlLCBzdHJpcCBvdXQgdGhlXG4gIC8vIHRyYWlsaW5nIHNsYXNoIChgQzpcXGFiY1xcZGVmYCAtPiBgQzpcXGFiY2ApLlxuICBpZiAoc3RhcnRQYXJ0ID4gMCAmJiBzdGFydFBhcnQgIT09IHJvb3RFbmQpIHtcbiAgICByZXQuZGlyID0gcGF0aC5zbGljZSgwLCBzdGFydFBhcnQgLSAxKTtcbiAgfSBlbHNlIHJldC5kaXIgPSByZXQucm9vdDtcblxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgZmlsZSBVUkwgdG8gYSBwYXRoIHN0cmluZy5cbiAqXG4gKiBgYGB0c1xuICogICAgICBpbXBvcnQgeyBmcm9tRmlsZVVybCB9IGZyb20gXCIuL3dpbjMyLnRzXCI7XG4gKiAgICAgIGZyb21GaWxlVXJsKFwiZmlsZTovLy9ob21lL2Zvb1wiKTsgLy8gXCJcXFxcaG9tZVxcXFxmb29cIlxuICogICAgICBmcm9tRmlsZVVybChcImZpbGU6Ly8vQzovVXNlcnMvZm9vXCIpOyAvLyBcIkM6XFxcXFVzZXJzXFxcXGZvb1wiXG4gKiAgICAgIGZyb21GaWxlVXJsKFwiZmlsZTovL2xvY2FsaG9zdC9ob21lL2Zvb1wiKTsgLy8gXCJcXFxcXFxcXGxvY2FsaG9zdFxcXFxob21lXFxcXGZvb1wiXG4gKiBgYGBcbiAqIEBwYXJhbSB1cmwgb2YgYSBmaWxlIFVSTFxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbUZpbGVVcmwodXJsOiBzdHJpbmcgfCBVUkwpOiBzdHJpbmcge1xuICB1cmwgPSB1cmwgaW5zdGFuY2VvZiBVUkwgPyB1cmwgOiBuZXcgVVJMKHVybCk7XG4gIGlmICh1cmwucHJvdG9jb2wgIT0gXCJmaWxlOlwiKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk11c3QgYmUgYSBmaWxlIFVSTC5cIik7XG4gIH1cbiAgbGV0IHBhdGggPSBkZWNvZGVVUklDb21wb25lbnQoXG4gICAgdXJsLnBhdGhuYW1lLnJlcGxhY2UoL1xcLy9nLCBcIlxcXFxcIikucmVwbGFjZSgvJSg/IVswLTlBLUZhLWZdezJ9KS9nLCBcIiUyNVwiKSxcbiAgKS5yZXBsYWNlKC9eXFxcXCooW0EtWmEtel06KShcXFxcfCQpLywgXCIkMVxcXFxcIik7XG4gIGlmICh1cmwuaG9zdG5hbWUgIT0gXCJcIikge1xuICAgIC8vIE5vdGU6IFRoZSBgVVJMYCBpbXBsZW1lbnRhdGlvbiBndWFyYW50ZWVzIHRoYXQgdGhlIGRyaXZlIGxldHRlciBhbmRcbiAgICAvLyBob3N0bmFtZSBhcmUgbXV0dWFsbHkgZXhjbHVzaXZlLiBPdGhlcndpc2UgaXQgd291bGQgbm90IGhhdmUgYmVlbiB2YWxpZFxuICAgIC8vIHRvIGFwcGVuZCB0aGUgaG9zdG5hbWUgYW5kIHBhdGggbGlrZSB0aGlzLlxuICAgIHBhdGggPSBgXFxcXFxcXFwke3VybC5ob3N0bmFtZX0ke3BhdGh9YDtcbiAgfVxuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIHBhdGggc3RyaW5nIHRvIGEgZmlsZSBVUkwuXG4gKlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgdG9GaWxlVXJsIH0gZnJvbSBcIi4vd2luMzIudHNcIjtcbiAqICAgICAgdG9GaWxlVXJsKFwiXFxcXGhvbWVcXFxcZm9vXCIpOyAvLyBuZXcgVVJMKFwiZmlsZTovLy9ob21lL2Zvb1wiKVxuICogICAgICB0b0ZpbGVVcmwoXCJDOlxcXFxVc2Vyc1xcXFxmb29cIik7IC8vIG5ldyBVUkwoXCJmaWxlOi8vL0M6L1VzZXJzL2Zvb1wiKVxuICogICAgICB0b0ZpbGVVcmwoXCJcXFxcXFxcXDEyNy4wLjAuMVxcXFxob21lXFxcXGZvb1wiKTsgLy8gbmV3IFVSTChcImZpbGU6Ly8xMjcuMC4wLjEvaG9tZS9mb29cIilcbiAqIGBgYFxuICogQHBhcmFtIHBhdGggdG8gY29udmVydCB0byBmaWxlIFVSTFxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9GaWxlVXJsKHBhdGg6IHN0cmluZyk6IFVSTCB7XG4gIGlmICghaXNBYnNvbHV0ZShwYXRoKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJNdXN0IGJlIGFuIGFic29sdXRlIHBhdGguXCIpO1xuICB9XG4gIGNvbnN0IFssIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBwYXRoLm1hdGNoKFxuICAgIC9eKD86Wy9cXFxcXXsyfShbXi9cXFxcXSspKD89Wy9cXFxcXSg/OlteL1xcXFxdfCQpKSk/KC4qKS8sXG4gICkhO1xuICBjb25zdCB1cmwgPSBuZXcgVVJMKFwiZmlsZTovLy9cIik7XG4gIHVybC5wYXRobmFtZSA9IGVuY29kZVdoaXRlc3BhY2UocGF0aG5hbWUucmVwbGFjZSgvJS9nLCBcIiUyNVwiKSk7XG4gIGlmIChob3N0bmFtZSAhPSBudWxsICYmIGhvc3RuYW1lICE9IFwibG9jYWxob3N0XCIpIHtcbiAgICB1cmwuaG9zdG5hbWUgPSBob3N0bmFtZTtcbiAgICBpZiAoIXVybC5ob3N0bmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgaG9zdG5hbWUuXCIpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdXJsO1xufVxuIiwiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCB0aGUgQnJvd3NlcmlmeSBhdXRob3JzLiBNSVQgTGljZW5zZS5cbi8vIFBvcnRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9icm93c2VyaWZ5L3BhdGgtYnJvd3NlcmlmeS9cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuaW1wb3J0IHR5cGUgeyBGb3JtYXRJbnB1dFBhdGhPYmplY3QsIFBhcnNlZFBhdGggfSBmcm9tIFwiLi9faW50ZXJmYWNlLnRzXCI7XG5pbXBvcnQgeyBDSEFSX0RPVCwgQ0hBUl9GT1JXQVJEX1NMQVNIIH0gZnJvbSBcIi4vX2NvbnN0YW50cy50c1wiO1xuXG5pbXBvcnQge1xuICBfZm9ybWF0LFxuICBhc3NlcnRQYXRoLFxuICBlbmNvZGVXaGl0ZXNwYWNlLFxuICBpc1Bvc2l4UGF0aFNlcGFyYXRvcixcbiAgbm9ybWFsaXplU3RyaW5nLFxufSBmcm9tIFwiLi9fdXRpbC50c1wiO1xuXG5leHBvcnQgY29uc3Qgc2VwID0gXCIvXCI7XG5leHBvcnQgY29uc3QgZGVsaW1pdGVyID0gXCI6XCI7XG5cbi8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcbi8qKlxuICogUmVzb2x2ZXMgYHBhdGhTZWdtZW50c2AgaW50byBhbiBhYnNvbHV0ZSBwYXRoLlxuICogQHBhcmFtIHBhdGhTZWdtZW50cyBhbiBhcnJheSBvZiBwYXRoIHNlZ21lbnRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlKC4uLnBhdGhTZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBsZXQgcmVzb2x2ZWRQYXRoID0gXCJcIjtcbiAgbGV0IHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gcGF0aFNlZ21lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgIGxldCBwYXRoOiBzdHJpbmc7XG5cbiAgICBpZiAoaSA+PSAwKSBwYXRoID0gcGF0aFNlZ21lbnRzW2ldO1xuICAgIGVsc2Uge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIGNvbnN0IHsgRGVubyB9ID0gZ2xvYmFsVGhpcyBhcyBhbnk7XG4gICAgICBpZiAodHlwZW9mIERlbm8/LmN3ZCAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJSZXNvbHZlZCBhIHJlbGF0aXZlIHBhdGggd2l0aG91dCBhIENXRC5cIik7XG4gICAgICB9XG4gICAgICBwYXRoID0gRGVuby5jd2QoKTtcbiAgICB9XG5cbiAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgLy8gU2tpcCBlbXB0eSBlbnRyaWVzXG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICByZXNvbHZlZFBhdGggPSBgJHtwYXRofS8ke3Jlc29sdmVkUGF0aH1gO1xuICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgLy8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZVN0cmluZyhcbiAgICByZXNvbHZlZFBhdGgsXG4gICAgIXJlc29sdmVkQWJzb2x1dGUsXG4gICAgXCIvXCIsXG4gICAgaXNQb3NpeFBhdGhTZXBhcmF0b3IsXG4gICk7XG5cbiAgaWYgKHJlc29sdmVkQWJzb2x1dGUpIHtcbiAgICBpZiAocmVzb2x2ZWRQYXRoLmxlbmd0aCA+IDApIHJldHVybiBgLyR7cmVzb2x2ZWRQYXRofWA7XG4gICAgZWxzZSByZXR1cm4gXCIvXCI7XG4gIH0gZWxzZSBpZiAocmVzb2x2ZWRQYXRoLmxlbmd0aCA+IDApIHJldHVybiByZXNvbHZlZFBhdGg7XG4gIGVsc2UgcmV0dXJuIFwiLlwiO1xufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgYHBhdGhgLCByZXNvbHZpbmcgYCcuLidgIGFuZCBgJy4nYCBzZWdtZW50cy5cbiAqIEBwYXJhbSBwYXRoIHRvIGJlIG5vcm1hbGl6ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZShwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiLlwiO1xuXG4gIGNvbnN0IGlzQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IENIQVJfRk9SV0FSRF9TTEFTSDtcbiAgY29uc3QgdHJhaWxpbmdTZXBhcmF0b3IgPVxuICAgIHBhdGguY2hhckNvZGVBdChwYXRoLmxlbmd0aCAtIDEpID09PSBDSEFSX0ZPUldBUkRfU0xBU0g7XG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHBhdGggPSBub3JtYWxpemVTdHJpbmcocGF0aCwgIWlzQWJzb2x1dGUsIFwiL1wiLCBpc1Bvc2l4UGF0aFNlcGFyYXRvcik7XG5cbiAgaWYgKHBhdGgubGVuZ3RoID09PSAwICYmICFpc0Fic29sdXRlKSBwYXRoID0gXCIuXCI7XG4gIGlmIChwYXRoLmxlbmd0aCA+IDAgJiYgdHJhaWxpbmdTZXBhcmF0b3IpIHBhdGggKz0gXCIvXCI7XG5cbiAgaWYgKGlzQWJzb2x1dGUpIHJldHVybiBgLyR7cGF0aH1gO1xuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBWZXJpZmllcyB3aGV0aGVyIHByb3ZpZGVkIHBhdGggaXMgYWJzb2x1dGVcbiAqIEBwYXJhbSBwYXRoIHRvIGJlIHZlcmlmaWVkIGFzIGFic29sdXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Fic29sdXRlKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBhc3NlcnRQYXRoKHBhdGgpO1xuICByZXR1cm4gcGF0aC5sZW5ndGggPiAwICYmIHBhdGguY2hhckNvZGVBdCgwKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIO1xufVxuXG4vKipcbiAqIEpvaW4gYWxsIGdpdmVuIGEgc2VxdWVuY2Ugb2YgYHBhdGhzYCx0aGVuIG5vcm1hbGl6ZXMgdGhlIHJlc3VsdGluZyBwYXRoLlxuICogQHBhcmFtIHBhdGhzIHRvIGJlIGpvaW5lZCBhbmQgbm9ybWFsaXplZFxuICovXG5leHBvcnQgZnVuY3Rpb24gam9pbiguLi5wYXRoczogc3RyaW5nW10pOiBzdHJpbmcge1xuICBpZiAocGF0aHMubGVuZ3RoID09PSAwKSByZXR1cm4gXCIuXCI7XG4gIGxldCBqb2luZWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHBhdGhzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgY29uc3QgcGF0aCA9IHBhdGhzW2ldO1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgaWYgKHBhdGgubGVuZ3RoID4gMCkge1xuICAgICAgaWYgKCFqb2luZWQpIGpvaW5lZCA9IHBhdGg7XG4gICAgICBlbHNlIGpvaW5lZCArPSBgLyR7cGF0aH1gO1xuICAgIH1cbiAgfVxuICBpZiAoIWpvaW5lZCkgcmV0dXJuIFwiLlwiO1xuICByZXR1cm4gbm9ybWFsaXplKGpvaW5lZCk7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSByZWxhdGl2ZSBwYXRoIGZyb20gYGZyb21gIHRvIGB0b2AgYmFzZWQgb24gY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeS5cbiAqIEBwYXJhbSBmcm9tIHBhdGggaW4gY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICogQHBhcmFtIHRvIHBhdGggaW4gY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVsYXRpdmUoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nKTogc3RyaW5nIHtcbiAgYXNzZXJ0UGF0aChmcm9tKTtcbiAgYXNzZXJ0UGF0aCh0byk7XG5cbiAgaWYgKGZyb20gPT09IHRvKSByZXR1cm4gXCJcIjtcblxuICBmcm9tID0gcmVzb2x2ZShmcm9tKTtcbiAgdG8gPSByZXNvbHZlKHRvKTtcblxuICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiBcIlwiO1xuXG4gIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgbGV0IGZyb21TdGFydCA9IDE7XG4gIGNvbnN0IGZyb21FbmQgPSBmcm9tLmxlbmd0aDtcbiAgZm9yICg7IGZyb21TdGFydCA8IGZyb21FbmQ7ICsrZnJvbVN0YXJ0KSB7XG4gICAgaWYgKGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQpICE9PSBDSEFSX0ZPUldBUkRfU0xBU0gpIGJyZWFrO1xuICB9XG4gIGNvbnN0IGZyb21MZW4gPSBmcm9tRW5kIC0gZnJvbVN0YXJ0O1xuXG4gIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgbGV0IHRvU3RhcnQgPSAxO1xuICBjb25zdCB0b0VuZCA9IHRvLmxlbmd0aDtcbiAgZm9yICg7IHRvU3RhcnQgPCB0b0VuZDsgKyt0b1N0YXJ0KSB7XG4gICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCkgIT09IENIQVJfRk9SV0FSRF9TTEFTSCkgYnJlYWs7XG4gIH1cbiAgY29uc3QgdG9MZW4gPSB0b0VuZCAtIHRvU3RhcnQ7XG5cbiAgLy8gQ29tcGFyZSBwYXRocyB0byBmaW5kIHRoZSBsb25nZXN0IGNvbW1vbiBwYXRoIGZyb20gcm9vdFxuICBjb25zdCBsZW5ndGggPSBmcm9tTGVuIDwgdG9MZW4gPyBmcm9tTGVuIDogdG9MZW47XG4gIGxldCBsYXN0Q29tbW9uU2VwID0gLTE7XG4gIGxldCBpID0gMDtcbiAgZm9yICg7IGkgPD0gbGVuZ3RoOyArK2kpIHtcbiAgICBpZiAoaSA9PT0gbGVuZ3RoKSB7XG4gICAgICBpZiAodG9MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgaWYgKHRvLmNoYXJDb2RlQXQodG9TdGFydCArIGkpID09PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGV4YWN0IGJhc2UgcGF0aCBmb3IgYHRvYC5cbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nL2Zvby9iYXInOyB0bz0nL2Zvby9iYXIvYmF6J1xuICAgICAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0ICsgaSArIDEpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIHJvb3RcbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nLyc7IHRvPScvZm9vJ1xuICAgICAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0ICsgaSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZnJvbUxlbiA+IGxlbmd0aCkge1xuICAgICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpID09PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSBleGFjdCBiYXNlIHBhdGggZm9yIGBmcm9tYC5cbiAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nL2Zvby9iYXIvYmF6JzsgdG89Jy9mb28vYmFyJ1xuICAgICAgICAgIGxhc3RDb21tb25TZXAgPSBpO1xuICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSByb290LlxuICAgICAgICAgIC8vIEZvciBleGFtcGxlOiBmcm9tPScvZm9vJzsgdG89Jy8nXG4gICAgICAgICAgbGFzdENvbW1vblNlcCA9IDA7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBmcm9tQ29kZSA9IGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQgKyBpKTtcbiAgICBjb25zdCB0b0NvZGUgPSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKTtcbiAgICBpZiAoZnJvbUNvZGUgIT09IHRvQ29kZSkgYnJlYWs7XG4gICAgZWxzZSBpZiAoZnJvbUNvZGUgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkgbGFzdENvbW1vblNlcCA9IGk7XG4gIH1cblxuICBsZXQgb3V0ID0gXCJcIjtcbiAgLy8gR2VuZXJhdGUgdGhlIHJlbGF0aXZlIHBhdGggYmFzZWQgb24gdGhlIHBhdGggZGlmZmVyZW5jZSBiZXR3ZWVuIGB0b2BcbiAgLy8gYW5kIGBmcm9tYFxuICBmb3IgKGkgPSBmcm9tU3RhcnQgKyBsYXN0Q29tbW9uU2VwICsgMTsgaSA8PSBmcm9tRW5kOyArK2kpIHtcbiAgICBpZiAoaSA9PT0gZnJvbUVuZCB8fCBmcm9tLmNoYXJDb2RlQXQoaSkgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkge1xuICAgICAgaWYgKG91dC5sZW5ndGggPT09IDApIG91dCArPSBcIi4uXCI7XG4gICAgICBlbHNlIG91dCArPSBcIi8uLlwiO1xuICAgIH1cbiAgfVxuXG4gIC8vIExhc3RseSwgYXBwZW5kIHRoZSByZXN0IG9mIHRoZSBkZXN0aW5hdGlvbiAoYHRvYCkgcGF0aCB0aGF0IGNvbWVzIGFmdGVyXG4gIC8vIHRoZSBjb21tb24gcGF0aCBwYXJ0c1xuICBpZiAob3V0Lmxlbmd0aCA+IDApIHJldHVybiBvdXQgKyB0by5zbGljZSh0b1N0YXJ0ICsgbGFzdENvbW1vblNlcCk7XG4gIGVsc2Uge1xuICAgIHRvU3RhcnQgKz0gbGFzdENvbW1vblNlcDtcbiAgICBpZiAodG8uY2hhckNvZGVBdCh0b1N0YXJ0KSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSArK3RvU3RhcnQ7XG4gICAgcmV0dXJuIHRvLnNsaWNlKHRvU3RhcnQpO1xuICB9XG59XG5cbi8qKlxuICogUmVzb2x2ZXMgcGF0aCB0byBhIG5hbWVzcGFjZSBwYXRoXG4gKiBAcGFyYW0gcGF0aCB0byByZXNvbHZlIHRvIG5hbWVzcGFjZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9OYW1lc3BhY2VkUGF0aChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBOb24tb3Agb24gcG9zaXggc3lzdGVtc1xuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGRpcmVjdG9yeSBuYW1lIG9mIGEgYHBhdGhgLlxuICogQHBhcmFtIHBhdGggdG8gZGV0ZXJtaW5lIG5hbWUgZm9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXJuYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGFzc2VydFBhdGgocGF0aCk7XG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFwiLlwiO1xuICBjb25zdCBoYXNSb290ID0gcGF0aC5jaGFyQ29kZUF0KDApID09PSBDSEFSX0ZPUldBUkRfU0xBU0g7XG4gIGxldCBlbmQgPSAtMTtcbiAgbGV0IG1hdGNoZWRTbGFzaCA9IHRydWU7XG4gIGZvciAobGV0IGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMTsgLS1pKSB7XG4gICAgaWYgKHBhdGguY2hhckNvZGVBdChpKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG4gICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICBlbmQgPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3JcbiAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmIChlbmQgPT09IC0xKSByZXR1cm4gaGFzUm9vdCA/IFwiL1wiIDogXCIuXCI7XG4gIGlmIChoYXNSb290ICYmIGVuZCA9PT0gMSkgcmV0dXJuIFwiLy9cIjtcbiAgcmV0dXJuIHBhdGguc2xpY2UoMCwgZW5kKTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gdGhlIGxhc3QgcG9ydGlvbiBvZiBhIGBwYXRoYC4gVHJhaWxpbmcgZGlyZWN0b3J5IHNlcGFyYXRvcnMgYXJlIGlnbm9yZWQuXG4gKiBAcGFyYW0gcGF0aCB0byBwcm9jZXNzXG4gKiBAcGFyYW0gZXh0IG9mIHBhdGggZGlyZWN0b3J5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlbmFtZShwYXRoOiBzdHJpbmcsIGV4dCA9IFwiXCIpOiBzdHJpbmcge1xuICBpZiAoZXh0ICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGV4dCAhPT0gXCJzdHJpbmdcIikge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiZXh0XCIgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZycpO1xuICB9XG4gIGFzc2VydFBhdGgocGF0aCk7XG5cbiAgbGV0IHN0YXJ0ID0gMDtcbiAgbGV0IGVuZCA9IC0xO1xuICBsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgbGV0IGk6IG51bWJlcjtcblxuICBpZiAoZXh0ICE9PSB1bmRlZmluZWQgJiYgZXh0Lmxlbmd0aCA+IDAgJiYgZXh0Lmxlbmd0aCA8PSBwYXRoLmxlbmd0aCkge1xuICAgIGlmIChleHQubGVuZ3RoID09PSBwYXRoLmxlbmd0aCAmJiBleHQgPT09IHBhdGgpIHJldHVybiBcIlwiO1xuICAgIGxldCBleHRJZHggPSBleHQubGVuZ3RoIC0gMTtcbiAgICBsZXQgZmlyc3ROb25TbGFzaEVuZCA9IC0xO1xuICAgIGZvciAoaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgICBpZiAoY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG4gICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChmaXJzdE5vblNsYXNoRW5kID09PSAtMSkge1xuICAgICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCByZW1lbWJlciB0aGlzIGluZGV4IGluIGNhc2VcbiAgICAgICAgICAvLyB3ZSBuZWVkIGl0IGlmIHRoZSBleHRlbnNpb24gZW5kcyB1cCBub3QgbWF0Y2hpbmdcbiAgICAgICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgICAgICBmaXJzdE5vblNsYXNoRW5kID0gaSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4dElkeCA+PSAwKSB7XG4gICAgICAgICAgLy8gVHJ5IHRvIG1hdGNoIHRoZSBleHBsaWNpdCBleHRlbnNpb25cbiAgICAgICAgICBpZiAoY29kZSA9PT0gZXh0LmNoYXJDb2RlQXQoZXh0SWR4KSkge1xuICAgICAgICAgICAgaWYgKC0tZXh0SWR4ID09PSAtMSkge1xuICAgICAgICAgICAgICAvLyBXZSBtYXRjaGVkIHRoZSBleHRlbnNpb24sIHNvIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91ciBwYXRoXG4gICAgICAgICAgICAgIC8vIGNvbXBvbmVudFxuICAgICAgICAgICAgICBlbmQgPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFeHRlbnNpb24gZG9lcyBub3QgbWF0Y2gsIHNvIG91ciByZXN1bHQgaXMgdGhlIGVudGlyZSBwYXRoXG4gICAgICAgICAgICAvLyBjb21wb25lbnRcbiAgICAgICAgICAgIGV4dElkeCA9IC0xO1xuICAgICAgICAgICAgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPT09IGVuZCkgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtcbiAgICBlbHNlIGlmIChlbmQgPT09IC0xKSBlbmQgPSBwYXRoLmxlbmd0aDtcbiAgICByZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICBpZiAocGF0aC5jaGFyQ29kZUF0KGkpID09PSBDSEFSX0ZPUldBUkRfU0xBU0gpIHtcbiAgICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICAgIGlmICghbWF0Y2hlZFNsYXNoKSB7XG4gICAgICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgICAgLy8gcGF0aCBjb21wb25lbnRcbiAgICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgICAgIGVuZCA9IGkgKyAxO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlbmQgPT09IC0xKSByZXR1cm4gXCJcIjtcbiAgICByZXR1cm4gcGF0aC5zbGljZShzdGFydCwgZW5kKTtcbiAgfVxufVxuXG4vKipcbiAqIFJldHVybiB0aGUgZXh0ZW5zaW9uIG9mIHRoZSBgcGF0aGAgd2l0aCBsZWFkaW5nIHBlcmlvZC5cbiAqIEBwYXJhbSBwYXRoIHdpdGggZXh0ZW5zaW9uXG4gKiBAcmV0dXJucyBleHRlbnNpb24gKGV4LiBmb3IgYGZpbGUudHNgIHJldHVybnMgYC50c2ApXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRuYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGFzc2VydFBhdGgocGF0aCk7XG4gIGxldCBzdGFydERvdCA9IC0xO1xuICBsZXQgc3RhcnRQYXJ0ID0gMDtcbiAgbGV0IGVuZCA9IC0xO1xuICBsZXQgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgLy8gVHJhY2sgdGhlIHN0YXRlIG9mIGNoYXJhY3RlcnMgKGlmIGFueSkgd2Ugc2VlIGJlZm9yZSBvdXIgZmlyc3QgZG90IGFuZFxuICAvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuICBsZXQgcHJlRG90U3RhdGUgPSAwO1xuICBmb3IgKGxldCBpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgIGNvbnN0IGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgaWYgKGNvZGUgPT09IENIQVJfRk9SV0FSRF9TTEFTSCkge1xuICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgaWYgKCFtYXRjaGVkU2xhc2gpIHtcbiAgICAgICAgc3RhcnRQYXJ0ID0gaSArIDE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG4gICAgICAvLyBleHRlbnNpb25cbiAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgZW5kID0gaSArIDE7XG4gICAgfVxuICAgIGlmIChjb2RlID09PSBDSEFSX0RPVCkge1xuICAgICAgLy8gSWYgdGhpcyBpcyBvdXIgZmlyc3QgZG90LCBtYXJrIGl0IGFzIHRoZSBzdGFydCBvZiBvdXIgZXh0ZW5zaW9uXG4gICAgICBpZiAoc3RhcnREb3QgPT09IC0xKSBzdGFydERvdCA9IGk7XG4gICAgICBlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSkgcHJlRG90U3RhdGUgPSAxO1xuICAgIH0gZWxzZSBpZiAoc3RhcnREb3QgIT09IC0xKSB7XG4gICAgICAvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuICAgICAgLy8gaGF2ZSBhIGdvb2QgY2hhbmNlIGF0IGhhdmluZyBhIG5vbi1lbXB0eSBleHRlbnNpb25cbiAgICAgIHByZURvdFN0YXRlID0gLTE7XG4gICAgfVxuICB9XG5cbiAgaWYgKFxuICAgIHN0YXJ0RG90ID09PSAtMSB8fFxuICAgIGVuZCA9PT0gLTEgfHxcbiAgICAvLyBXZSBzYXcgYSBub24tZG90IGNoYXJhY3RlciBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvdFxuICAgIHByZURvdFN0YXRlID09PSAwIHx8XG4gICAgLy8gVGhlIChyaWdodC1tb3N0KSB0cmltbWVkIHBhdGggY29tcG9uZW50IGlzIGV4YWN0bHkgJy4uJ1xuICAgIChwcmVEb3RTdGF0ZSA9PT0gMSAmJiBzdGFydERvdCA9PT0gZW5kIC0gMSAmJiBzdGFydERvdCA9PT0gc3RhcnRQYXJ0ICsgMSlcbiAgKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbiAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG59XG5cbi8qKlxuICogR2VuZXJhdGUgYSBwYXRoIGZyb20gYEZvcm1hdElucHV0UGF0aE9iamVjdGAgb2JqZWN0LlxuICogQHBhcmFtIHBhdGhPYmplY3Qgd2l0aCBwYXRoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXQocGF0aE9iamVjdDogRm9ybWF0SW5wdXRQYXRoT2JqZWN0KTogc3RyaW5nIHtcbiAgaWYgKHBhdGhPYmplY3QgPT09IG51bGwgfHwgdHlwZW9mIHBhdGhPYmplY3QgIT09IFwib2JqZWN0XCIpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgYFRoZSBcInBhdGhPYmplY3RcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgT2JqZWN0LiBSZWNlaXZlZCB0eXBlICR7dHlwZW9mIHBhdGhPYmplY3R9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBfZm9ybWF0KFwiL1wiLCBwYXRoT2JqZWN0KTtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSBgUGFyc2VkUGF0aGAgb2JqZWN0IG9mIHRoZSBgcGF0aGAuXG4gKiBAcGFyYW0gcGF0aCB0byBwcm9jZXNzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShwYXRoOiBzdHJpbmcpOiBQYXJzZWRQYXRoIHtcbiAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICBjb25zdCByZXQ6IFBhcnNlZFBhdGggPSB7IHJvb3Q6IFwiXCIsIGRpcjogXCJcIiwgYmFzZTogXCJcIiwgZXh0OiBcIlwiLCBuYW1lOiBcIlwiIH07XG4gIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHJldDtcbiAgY29uc3QgaXNBYnNvbHV0ZSA9IHBhdGguY2hhckNvZGVBdCgwKSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIO1xuICBsZXQgc3RhcnQ6IG51bWJlcjtcbiAgaWYgKGlzQWJzb2x1dGUpIHtcbiAgICByZXQucm9vdCA9IFwiL1wiO1xuICAgIHN0YXJ0ID0gMTtcbiAgfSBlbHNlIHtcbiAgICBzdGFydCA9IDA7XG4gIH1cbiAgbGV0IHN0YXJ0RG90ID0gLTE7XG4gIGxldCBzdGFydFBhcnQgPSAwO1xuICBsZXQgZW5kID0gLTE7XG4gIGxldCBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICBsZXQgaSA9IHBhdGgubGVuZ3RoIC0gMTtcblxuICAvLyBUcmFjayB0aGUgc3RhdGUgb2YgY2hhcmFjdGVycyAoaWYgYW55KSB3ZSBzZWUgYmVmb3JlIG91ciBmaXJzdCBkb3QgYW5kXG4gIC8vIGFmdGVyIGFueSBwYXRoIHNlcGFyYXRvciB3ZSBmaW5kXG4gIGxldCBwcmVEb3RTdGF0ZSA9IDA7XG5cbiAgLy8gR2V0IG5vbi1kaXIgaW5mb1xuICBmb3IgKDsgaSA+PSBzdGFydDsgLS1pKSB7XG4gICAgY29uc3QgY29kZSA9IHBhdGguY2hhckNvZGVBdChpKTtcbiAgICBpZiAoY29kZSA9PT0gQ0hBUl9GT1JXQVJEX1NMQVNIKSB7XG4gICAgICAvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICBzdGFydFBhcnQgPSBpICsgMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgIC8vIGV4dGVuc2lvblxuICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgICBlbmQgPSBpICsgMTtcbiAgICB9XG4gICAgaWYgKGNvZGUgPT09IENIQVJfRE9UKSB7XG4gICAgICAvLyBJZiB0aGlzIGlzIG91ciBmaXJzdCBkb3QsIG1hcmsgaXQgYXMgdGhlIHN0YXJ0IG9mIG91ciBleHRlbnNpb25cbiAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpIHN0YXJ0RG90ID0gaTtcbiAgICAgIGVsc2UgaWYgKHByZURvdFN0YXRlICE9PSAxKSBwcmVEb3RTdGF0ZSA9IDE7XG4gICAgfSBlbHNlIGlmIChzdGFydERvdCAhPT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgYW5kIG5vbi1wYXRoIHNlcGFyYXRvciBiZWZvcmUgb3VyIGRvdCwgc28gd2Ugc2hvdWxkXG4gICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgcHJlRG90U3RhdGUgPSAtMTtcbiAgICB9XG4gIH1cblxuICBpZiAoXG4gICAgc3RhcnREb3QgPT09IC0xIHx8XG4gICAgZW5kID09PSAtMSB8fFxuICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG4gICAgcHJlRG90U3RhdGUgPT09IDAgfHxcbiAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgKHByZURvdFN0YXRlID09PSAxICYmIHN0YXJ0RG90ID09PSBlbmQgLSAxICYmIHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKVxuICApIHtcbiAgICBpZiAoZW5kICE9PSAtMSkge1xuICAgICAgaWYgKHN0YXJ0UGFydCA9PT0gMCAmJiBpc0Fic29sdXRlKSB7XG4gICAgICAgIHJldC5iYXNlID0gcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKDEsIGVuZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXQuYmFzZSA9IHJldC5uYW1lID0gcGF0aC5zbGljZShzdGFydFBhcnQsIGVuZCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChzdGFydFBhcnQgPT09IDAgJiYgaXNBYnNvbHV0ZSkge1xuICAgICAgcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKDEsIHN0YXJ0RG90KTtcbiAgICAgIHJldC5iYXNlID0gcGF0aC5zbGljZSgxLCBlbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXQubmFtZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBzdGFydERvdCk7XG4gICAgICByZXQuYmFzZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBlbmQpO1xuICAgIH1cbiAgICByZXQuZXh0ID0gcGF0aC5zbGljZShzdGFydERvdCwgZW5kKTtcbiAgfVxuXG4gIGlmIChzdGFydFBhcnQgPiAwKSByZXQuZGlyID0gcGF0aC5zbGljZSgwLCBzdGFydFBhcnQgLSAxKTtcbiAgZWxzZSBpZiAoaXNBYnNvbHV0ZSkgcmV0LmRpciA9IFwiL1wiO1xuXG4gIHJldHVybiByZXQ7XG59XG5cbi8qKlxuICogQ29udmVydHMgYSBmaWxlIFVSTCB0byBhIHBhdGggc3RyaW5nLlxuICpcbiAqIGBgYHRzXG4gKiAgICAgIGltcG9ydCB7IGZyb21GaWxlVXJsIH0gZnJvbSBcIi4vcG9zaXgudHNcIjtcbiAqICAgICAgZnJvbUZpbGVVcmwoXCJmaWxlOi8vL2hvbWUvZm9vXCIpOyAvLyBcIi9ob21lL2Zvb1wiXG4gKiBgYGBcbiAqIEBwYXJhbSB1cmwgb2YgYSBmaWxlIFVSTFxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbUZpbGVVcmwodXJsOiBzdHJpbmcgfCBVUkwpOiBzdHJpbmcge1xuICB1cmwgPSB1cmwgaW5zdGFuY2VvZiBVUkwgPyB1cmwgOiBuZXcgVVJMKHVybCk7XG4gIGlmICh1cmwucHJvdG9jb2wgIT0gXCJmaWxlOlwiKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk11c3QgYmUgYSBmaWxlIFVSTC5cIik7XG4gIH1cbiAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChcbiAgICB1cmwucGF0aG5hbWUucmVwbGFjZSgvJSg/IVswLTlBLUZhLWZdezJ9KS9nLCBcIiUyNVwiKSxcbiAgKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhIHBhdGggc3RyaW5nIHRvIGEgZmlsZSBVUkwuXG4gKlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgdG9GaWxlVXJsIH0gZnJvbSBcIi4vcG9zaXgudHNcIjtcbiAqICAgICAgdG9GaWxlVXJsKFwiL2hvbWUvZm9vXCIpOyAvLyBuZXcgVVJMKFwiZmlsZTovLy9ob21lL2Zvb1wiKVxuICogYGBgXG4gKiBAcGFyYW0gcGF0aCB0byBjb252ZXJ0IHRvIGZpbGUgVVJMXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0ZpbGVVcmwocGF0aDogc3RyaW5nKTogVVJMIHtcbiAgaWYgKCFpc0Fic29sdXRlKHBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk11c3QgYmUgYW4gYWJzb2x1dGUgcGF0aC5cIik7XG4gIH1cbiAgY29uc3QgdXJsID0gbmV3IFVSTChcImZpbGU6Ly8vXCIpO1xuICB1cmwucGF0aG5hbWUgPSBlbmNvZGVXaGl0ZXNwYWNlKFxuICAgIHBhdGgucmVwbGFjZSgvJS9nLCBcIiUyNVwiKS5yZXBsYWNlKC9cXFxcL2csIFwiJTVDXCIpLFxuICApO1xuICByZXR1cm4gdXJsO1xufVxuIiwiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuaW1wb3J0IHsgaXNXaW5kb3dzLCBvc1R5cGUgfSBmcm9tIFwiLi4vX3V0aWwvb3MudHNcIjtcbmltcG9ydCB7IFNFUCwgU0VQX1BBVFRFUk4gfSBmcm9tIFwiLi9zZXBhcmF0b3IudHNcIjtcbmltcG9ydCAqIGFzIF93aW4zMiBmcm9tIFwiLi93aW4zMi50c1wiO1xuaW1wb3J0ICogYXMgX3Bvc2l4IGZyb20gXCIuL3Bvc2l4LnRzXCI7XG5pbXBvcnQgdHlwZSB7IE9TVHlwZSB9IGZyb20gXCIuLi9fdXRpbC9vcy50c1wiO1xuXG5jb25zdCBwYXRoID0gaXNXaW5kb3dzID8gX3dpbjMyIDogX3Bvc2l4O1xuY29uc3QgeyBqb2luLCBub3JtYWxpemUgfSA9IHBhdGg7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2xvYk9wdGlvbnMge1xuICAvKiogRXh0ZW5kZWQgZ2xvYiBzeW50YXguXG4gICAqIFNlZSBodHRwczovL3d3dy5saW51eGpvdXJuYWwuY29tL2NvbnRlbnQvYmFzaC1leHRlbmRlZC1nbG9iYmluZy4gRGVmYXVsdHNcbiAgICogdG8gdHJ1ZS4gKi9cbiAgZXh0ZW5kZWQ/OiBib29sZWFuO1xuICAvKiogR2xvYnN0YXIgc3ludGF4LlxuICAgKiBTZWUgaHR0cHM6Ly93d3cubGludXhqb3VybmFsLmNvbS9jb250ZW50L2dsb2JzdGFyLW5ldy1iYXNoLWdsb2JiaW5nLW9wdGlvbi5cbiAgICogSWYgZmFsc2UsIGAqKmAgaXMgdHJlYXRlZCBsaWtlIGAqYC4gRGVmYXVsdHMgdG8gdHJ1ZS4gKi9cbiAgZ2xvYnN0YXI/OiBib29sZWFuO1xuICAvKiogV2hldGhlciBnbG9ic3RhciBzaG91bGQgYmUgY2FzZSBpbnNlbnNpdGl2ZS4gKi9cbiAgY2FzZUluc2Vuc2l0aXZlPzogYm9vbGVhbjtcbiAgLyoqIE9wZXJhdGluZyBzeXN0ZW0uIERlZmF1bHRzIHRvIHRoZSBuYXRpdmUgT1MuICovXG4gIG9zPzogT1NUeXBlO1xufVxuXG5leHBvcnQgdHlwZSBHbG9iVG9SZWdFeHBPcHRpb25zID0gR2xvYk9wdGlvbnM7XG5cbmNvbnN0IHJlZ0V4cEVzY2FwZUNoYXJzID0gW1xuICBcIiFcIixcbiAgXCIkXCIsXG4gIFwiKFwiLFxuICBcIilcIixcbiAgXCIqXCIsXG4gIFwiK1wiLFxuICBcIi5cIixcbiAgXCI9XCIsXG4gIFwiP1wiLFxuICBcIltcIixcbiAgXCJcXFxcXCIsXG4gIFwiXlwiLFxuICBcIntcIixcbiAgXCJ8XCIsXG5dO1xuY29uc3QgcmFuZ2VFc2NhcGVDaGFycyA9IFtcIi1cIiwgXCJcXFxcXCIsIFwiXVwiXTtcblxuLyoqIENvbnZlcnQgYSBnbG9iIHN0cmluZyB0byBhIHJlZ3VsYXIgZXhwcmVzc2lvbi5cbiAqXG4gKiBUcmllcyB0byBtYXRjaCBiYXNoIGdsb2IgZXhwYW5zaW9uIGFzIGNsb3NlbHkgYXMgcG9zc2libGUuXG4gKlxuICogQmFzaWMgZ2xvYiBzeW50YXg6XG4gKiAtIGAqYCAtIE1hdGNoZXMgZXZlcnl0aGluZyB3aXRob3V0IGxlYXZpbmcgdGhlIHBhdGggc2VnbWVudC5cbiAqIC0gYD9gIC0gTWF0Y2hlcyBhbnkgc2luZ2xlIGNoYXJhY3Rlci5cbiAqIC0gYHtmb28sYmFyfWAgLSBNYXRjaGVzIGBmb29gIG9yIGBiYXJgLlxuICogLSBgW2FiY2RdYCAtIE1hdGNoZXMgYGFgLCBgYmAsIGBjYCBvciBgZGAuXG4gKiAtIGBbYS1kXWAgLSBNYXRjaGVzIGBhYCwgYGJgLCBgY2Agb3IgYGRgLlxuICogLSBgWyFhYmNkXWAgLSBNYXRjaGVzIGFueSBzaW5nbGUgY2hhcmFjdGVyIGJlc2lkZXMgYGFgLCBgYmAsIGBjYCBvciBgZGAuXG4gKiAtIGBbWzo8Y2xhc3M+Ol1dYCAtIE1hdGNoZXMgYW55IGNoYXJhY3RlciBiZWxvbmdpbmcgdG8gYDxjbGFzcz5gLlxuICogICAgIC0gYFtbOmFsbnVtOl1dYCAtIE1hdGNoZXMgYW55IGRpZ2l0IG9yIGxldHRlci5cbiAqICAgICAtIGBbWzpkaWdpdDpdYWJjXWAgLSBNYXRjaGVzIGFueSBkaWdpdCwgYGFgLCBgYmAgb3IgYGNgLlxuICogICAgIC0gU2VlIGh0dHBzOi8vZmFjZWxlc3N1c2VyLmdpdGh1Yi5pby93Y21hdGNoL2dsb2IvI3Bvc2l4LWNoYXJhY3Rlci1jbGFzc2VzXG4gKiAgICAgICBmb3IgYSBjb21wbGV0ZSBsaXN0IG9mIHN1cHBvcnRlZCBjaGFyYWN0ZXIgY2xhc3Nlcy5cbiAqIC0gYFxcYCAtIEVzY2FwZXMgdGhlIG5leHQgY2hhcmFjdGVyIGZvciBhbiBgb3NgIG90aGVyIHRoYW4gYFwid2luZG93c1wiYC5cbiAqIC0gXFxgIC0gRXNjYXBlcyB0aGUgbmV4dCBjaGFyYWN0ZXIgZm9yIGBvc2Agc2V0IHRvIGBcIndpbmRvd3NcImAuXG4gKiAtIGAvYCAtIFBhdGggc2VwYXJhdG9yLlxuICogLSBgXFxgIC0gQWRkaXRpb25hbCBwYXRoIHNlcGFyYXRvciBvbmx5IGZvciBgb3NgIHNldCB0byBgXCJ3aW5kb3dzXCJgLlxuICpcbiAqIEV4dGVuZGVkIHN5bnRheDpcbiAqIC0gUmVxdWlyZXMgYHsgZXh0ZW5kZWQ6IHRydWUgfWAuXG4gKiAtIGA/KGZvb3xiYXIpYCAtIE1hdGNoZXMgMCBvciAxIGluc3RhbmNlIG9mIGB7Zm9vLGJhcn1gLlxuICogLSBgQChmb298YmFyKWAgLSBNYXRjaGVzIDEgaW5zdGFuY2Ugb2YgYHtmb28sYmFyfWAuIFRoZXkgYmVoYXZlIHRoZSBzYW1lLlxuICogLSBgKihmb298YmFyKWAgLSBNYXRjaGVzIF9uXyBpbnN0YW5jZXMgb2YgYHtmb28sYmFyfWAuXG4gKiAtIGArKGZvb3xiYXIpYCAtIE1hdGNoZXMgX24gPiAwXyBpbnN0YW5jZXMgb2YgYHtmb28sYmFyfWAuXG4gKiAtIGAhKGZvb3xiYXIpYCAtIE1hdGNoZXMgYW55dGhpbmcgb3RoZXIgdGhhbiBge2ZvbyxiYXJ9YC5cbiAqIC0gU2VlIGh0dHBzOi8vd3d3LmxpbnV4am91cm5hbC5jb20vY29udGVudC9iYXNoLWV4dGVuZGVkLWdsb2JiaW5nLlxuICpcbiAqIEdsb2JzdGFyIHN5bnRheDpcbiAqIC0gUmVxdWlyZXMgYHsgZ2xvYnN0YXI6IHRydWUgfWAuXG4gKiAtIGAqKmAgLSBNYXRjaGVzIGFueSBudW1iZXIgb2YgYW55IHBhdGggc2VnbWVudHMuXG4gKiAgICAgLSBNdXN0IGNvbXByaXNlIGl0cyBlbnRpcmUgcGF0aCBzZWdtZW50IGluIHRoZSBwcm92aWRlZCBnbG9iLlxuICogLSBTZWUgaHR0cHM6Ly93d3cubGludXhqb3VybmFsLmNvbS9jb250ZW50L2dsb2JzdGFyLW5ldy1iYXNoLWdsb2JiaW5nLW9wdGlvbi5cbiAqXG4gKiBOb3RlIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAqIC0gVGhlIGdlbmVyYXRlZCBgUmVnRXhwYCBpcyBhbmNob3JlZCBhdCBib3RoIHN0YXJ0IGFuZCBlbmQuXG4gKiAtIFJlcGVhdGluZyBhbmQgdHJhaWxpbmcgc2VwYXJhdG9ycyBhcmUgdG9sZXJhdGVkLiBUcmFpbGluZyBzZXBhcmF0b3JzIGluIHRoZVxuICogICBwcm92aWRlZCBnbG9iIGhhdmUgbm8gbWVhbmluZyBhbmQgYXJlIGRpc2NhcmRlZC5cbiAqIC0gQWJzb2x1dGUgZ2xvYnMgd2lsbCBvbmx5IG1hdGNoIGFic29sdXRlIHBhdGhzLCBldGMuXG4gKiAtIEVtcHR5IGdsb2JzIHdpbGwgbWF0Y2ggbm90aGluZy5cbiAqIC0gQW55IHNwZWNpYWwgZ2xvYiBzeW50YXggbXVzdCBiZSBjb250YWluZWQgdG8gb25lIHBhdGggc2VnbWVudC4gRm9yIGV4YW1wbGUsXG4gKiAgIGA/KGZvb3xiYXIvYmF6KWAgaXMgaW52YWxpZC4gVGhlIHNlcGFyYXRvciB3aWxsIHRha2UgcHJlY2VkZW5jZSBhbmQgdGhlXG4gKiAgIGZpcnN0IHNlZ21lbnQgZW5kcyB3aXRoIGFuIHVuY2xvc2VkIGdyb3VwLlxuICogLSBJZiBhIHBhdGggc2VnbWVudCBlbmRzIHdpdGggdW5jbG9zZWQgZ3JvdXBzIG9yIGEgZGFuZ2xpbmcgZXNjYXBlIHByZWZpeCwgYVxuICogICBwYXJzZSBlcnJvciBoYXMgb2NjdXJyZWQuIEV2ZXJ5IGNoYXJhY3RlciBmb3IgdGhhdCBzZWdtZW50IGlzIHRha2VuXG4gKiAgIGxpdGVyYWxseSBpbiB0aGlzIGV2ZW50LlxuICpcbiAqIExpbWl0YXRpb25zOlxuICogLSBBIG5lZ2F0aXZlIGdyb3VwIGxpa2UgYCEoZm9vfGJhcilgIHdpbGwgd3JvbmdseSBiZSBjb252ZXJ0ZWQgdG8gYSBuZWdhdGl2ZVxuICogICBsb29rLWFoZWFkIGZvbGxvd2VkIGJ5IGEgd2lsZGNhcmQuIFRoaXMgbWVhbnMgdGhhdCBgIShmb28pLmpzYCB3aWxsIHdyb25nbHlcbiAqICAgZmFpbCB0byBtYXRjaCBgZm9vYmFyLmpzYCwgZXZlbiB0aG91Z2ggYGZvb2JhcmAgaXMgbm90IGBmb29gLiBFZmZlY3RpdmVseSxcbiAqICAgYCEoZm9vfGJhcilgIGlzIHRyZWF0ZWQgbGlrZSBgIShAKGZvb3xiYXIpKilgLiBUaGlzIHdpbGwgd29yayBjb3JyZWN0bHkgaWZcbiAqICAgdGhlIGdyb3VwIG9jY3VycyBub3QgbmVzdGVkIGF0IHRoZSBlbmQgb2YgdGhlIHNlZ21lbnQuICovXG5leHBvcnQgZnVuY3Rpb24gZ2xvYlRvUmVnRXhwKFxuICBnbG9iOiBzdHJpbmcsXG4gIHtcbiAgICBleHRlbmRlZCA9IHRydWUsXG4gICAgZ2xvYnN0YXI6IGdsb2JzdGFyT3B0aW9uID0gdHJ1ZSxcbiAgICBvcyA9IG9zVHlwZSxcbiAgICBjYXNlSW5zZW5zaXRpdmUgPSBmYWxzZSxcbiAgfTogR2xvYlRvUmVnRXhwT3B0aW9ucyA9IHt9LFxuKTogUmVnRXhwIHtcbiAgaWYgKGdsb2IgPT0gXCJcIikge1xuICAgIHJldHVybiAvKD8hKS87XG4gIH1cblxuICBjb25zdCBzZXAgPSBvcyA9PSBcIndpbmRvd3NcIiA/IFwiKD86XFxcXFxcXFx8LykrXCIgOiBcIi8rXCI7XG4gIGNvbnN0IHNlcE1heWJlID0gb3MgPT0gXCJ3aW5kb3dzXCIgPyBcIig/OlxcXFxcXFxcfC8pKlwiIDogXCIvKlwiO1xuICBjb25zdCBzZXBzID0gb3MgPT0gXCJ3aW5kb3dzXCIgPyBbXCJcXFxcXCIsIFwiL1wiXSA6IFtcIi9cIl07XG4gIGNvbnN0IGdsb2JzdGFyID0gb3MgPT0gXCJ3aW5kb3dzXCJcbiAgICA/IFwiKD86W15cXFxcXFxcXC9dKig/OlxcXFxcXFxcfC98JCkrKSpcIlxuICAgIDogXCIoPzpbXi9dKig/Oi98JCkrKSpcIjtcbiAgY29uc3Qgd2lsZGNhcmQgPSBvcyA9PSBcIndpbmRvd3NcIiA/IFwiW15cXFxcXFxcXC9dKlwiIDogXCJbXi9dKlwiO1xuICBjb25zdCBlc2NhcGVQcmVmaXggPSBvcyA9PSBcIndpbmRvd3NcIiA/IFwiYFwiIDogXCJcXFxcXCI7XG5cbiAgLy8gUmVtb3ZlIHRyYWlsaW5nIHNlcGFyYXRvcnMuXG4gIGxldCBuZXdMZW5ndGggPSBnbG9iLmxlbmd0aDtcbiAgZm9yICg7IG5ld0xlbmd0aCA+IDEgJiYgc2Vwcy5pbmNsdWRlcyhnbG9iW25ld0xlbmd0aCAtIDFdKTsgbmV3TGVuZ3RoLS0pO1xuICBnbG9iID0gZ2xvYi5zbGljZSgwLCBuZXdMZW5ndGgpO1xuXG4gIGxldCByZWdFeHBTdHJpbmcgPSBcIlwiO1xuXG4gIC8vIFRlcm1pbmF0ZXMgY29ycmVjdGx5LiBUcnVzdCB0aGF0IGBqYCBpcyBpbmNyZW1lbnRlZCBldmVyeSBpdGVyYXRpb24uXG4gIGZvciAobGV0IGogPSAwOyBqIDwgZ2xvYi5sZW5ndGg7KSB7XG4gICAgbGV0IHNlZ21lbnQgPSBcIlwiO1xuICAgIGNvbnN0IGdyb3VwU3RhY2s6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGluUmFuZ2UgPSBmYWxzZTtcbiAgICBsZXQgaW5Fc2NhcGUgPSBmYWxzZTtcbiAgICBsZXQgZW5kc1dpdGhTZXAgPSBmYWxzZTtcbiAgICBsZXQgaSA9IGo7XG5cbiAgICAvLyBUZXJtaW5hdGVzIHdpdGggYGlgIGF0IHRoZSBub24taW5jbHVzaXZlIGVuZCBvZiB0aGUgY3VycmVudCBzZWdtZW50LlxuICAgIGZvciAoOyBpIDwgZ2xvYi5sZW5ndGggJiYgIXNlcHMuaW5jbHVkZXMoZ2xvYltpXSk7IGkrKykge1xuICAgICAgaWYgKGluRXNjYXBlKSB7XG4gICAgICAgIGluRXNjYXBlID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGVzY2FwZUNoYXJzID0gaW5SYW5nZSA/IHJhbmdlRXNjYXBlQ2hhcnMgOiByZWdFeHBFc2NhcGVDaGFycztcbiAgICAgICAgc2VnbWVudCArPSBlc2NhcGVDaGFycy5pbmNsdWRlcyhnbG9iW2ldKSA/IGBcXFxcJHtnbG9iW2ldfWAgOiBnbG9iW2ldO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gZXNjYXBlUHJlZml4KSB7XG4gICAgICAgIGluRXNjYXBlID0gdHJ1ZTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChnbG9iW2ldID09IFwiW1wiKSB7XG4gICAgICAgIGlmICghaW5SYW5nZSkge1xuICAgICAgICAgIGluUmFuZ2UgPSB0cnVlO1xuICAgICAgICAgIHNlZ21lbnQgKz0gXCJbXCI7XG4gICAgICAgICAgaWYgKGdsb2JbaSArIDFdID09IFwiIVwiKSB7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBzZWdtZW50ICs9IFwiXlwiO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZ2xvYltpICsgMV0gPT0gXCJeXCIpIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIHNlZ21lbnQgKz0gXCJcXFxcXlwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIGlmIChnbG9iW2kgKyAxXSA9PSBcIjpcIikge1xuICAgICAgICAgIGxldCBrID0gaSArIDE7XG4gICAgICAgICAgbGV0IHZhbHVlID0gXCJcIjtcbiAgICAgICAgICB3aGlsZSAoZ2xvYltrICsgMV0gIT0gbnVsbCAmJiBnbG9iW2sgKyAxXSAhPSBcIjpcIikge1xuICAgICAgICAgICAgdmFsdWUgKz0gZ2xvYltrICsgMV07XG4gICAgICAgICAgICBrKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChnbG9iW2sgKyAxXSA9PSBcIjpcIiAmJiBnbG9iW2sgKyAyXSA9PSBcIl1cIikge1xuICAgICAgICAgICAgaSA9IGsgKyAyO1xuICAgICAgICAgICAgaWYgKHZhbHVlID09IFwiYWxudW1cIikgc2VnbWVudCArPSBcIlxcXFxkQS1aYS16XCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImFscGhhXCIpIHNlZ21lbnQgKz0gXCJBLVphLXpcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwiYXNjaWlcIikgc2VnbWVudCArPSBcIlxceDAwLVxceDdGXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImJsYW5rXCIpIHNlZ21lbnQgKz0gXCJcXHQgXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImNudHJsXCIpIHNlZ21lbnQgKz0gXCJcXHgwMC1cXHgxRlxceDdGXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcImRpZ2l0XCIpIHNlZ21lbnQgKz0gXCJcXFxcZFwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJncmFwaFwiKSBzZWdtZW50ICs9IFwiXFx4MjEtXFx4N0VcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwibG93ZXJcIikgc2VnbWVudCArPSBcImEtelwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJwcmludFwiKSBzZWdtZW50ICs9IFwiXFx4MjAtXFx4N0VcIjtcbiAgICAgICAgICAgIGVsc2UgaWYgKHZhbHVlID09IFwicHVuY3RcIikge1xuICAgICAgICAgICAgICBzZWdtZW50ICs9IFwiIVxcXCIjJCUmJygpKissXFxcXC0uLzo7PD0+P0BbXFxcXFxcXFxcXFxcXV5f4oCYe3x9flwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PSBcInNwYWNlXCIpIHNlZ21lbnQgKz0gXCJcXFxcc1xcdlwiO1xuICAgICAgICAgICAgZWxzZSBpZiAodmFsdWUgPT0gXCJ1cHBlclwiKSBzZWdtZW50ICs9IFwiQS1aXCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcIndvcmRcIikgc2VnbWVudCArPSBcIlxcXFx3XCI7XG4gICAgICAgICAgICBlbHNlIGlmICh2YWx1ZSA9PSBcInhkaWdpdFwiKSBzZWdtZW50ICs9IFwiXFxcXGRBLUZhLWZcIjtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIl1cIiAmJiBpblJhbmdlKSB7XG4gICAgICAgIGluUmFuZ2UgPSBmYWxzZTtcbiAgICAgICAgc2VnbWVudCArPSBcIl1cIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpblJhbmdlKSB7XG4gICAgICAgIGlmIChnbG9iW2ldID09IFwiXFxcXFwiKSB7XG4gICAgICAgICAgc2VnbWVudCArPSBgXFxcXFxcXFxgO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlZ21lbnQgKz0gZ2xvYltpXTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBnbG9iW2ldID09IFwiKVwiICYmIGdyb3VwU3RhY2subGVuZ3RoID4gMCAmJlxuICAgICAgICBncm91cFN0YWNrW2dyb3VwU3RhY2subGVuZ3RoIC0gMV0gIT0gXCJCUkFDRVwiXG4gICAgICApIHtcbiAgICAgICAgc2VnbWVudCArPSBcIilcIjtcbiAgICAgICAgY29uc3QgdHlwZSA9IGdyb3VwU3RhY2sucG9wKCkhO1xuICAgICAgICBpZiAodHlwZSA9PSBcIiFcIikge1xuICAgICAgICAgIHNlZ21lbnQgKz0gd2lsZGNhcmQ7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSAhPSBcIkBcIikge1xuICAgICAgICAgIHNlZ21lbnQgKz0gdHlwZTtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBnbG9iW2ldID09IFwifFwiICYmIGdyb3VwU3RhY2subGVuZ3RoID4gMCAmJlxuICAgICAgICBncm91cFN0YWNrW2dyb3VwU3RhY2subGVuZ3RoIC0gMV0gIT0gXCJCUkFDRVwiXG4gICAgICApIHtcbiAgICAgICAgc2VnbWVudCArPSBcInxcIjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChnbG9iW2ldID09IFwiK1wiICYmIGV4dGVuZGVkICYmIGdsb2JbaSArIDFdID09IFwiKFwiKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgZ3JvdXBTdGFjay5wdXNoKFwiK1wiKTtcbiAgICAgICAgc2VnbWVudCArPSBcIig/OlwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCJAXCIgJiYgZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgaSsrO1xuICAgICAgICBncm91cFN0YWNrLnB1c2goXCJAXCIpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKD86XCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIj9cIikge1xuICAgICAgICBpZiAoZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZ3JvdXBTdGFjay5wdXNoKFwiP1wiKTtcbiAgICAgICAgICBzZWdtZW50ICs9IFwiKD86XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VnbWVudCArPSBcIi5cIjtcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCIhXCIgJiYgZXh0ZW5kZWQgJiYgZ2xvYltpICsgMV0gPT0gXCIoXCIpIHtcbiAgICAgICAgaSsrO1xuICAgICAgICBncm91cFN0YWNrLnB1c2goXCIhXCIpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKD8hXCI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoZ2xvYltpXSA9PSBcIntcIikge1xuICAgICAgICBncm91cFN0YWNrLnB1c2goXCJCUkFDRVwiKTtcbiAgICAgICAgc2VnbWVudCArPSBcIig/OlwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCJ9XCIgJiYgZ3JvdXBTdGFja1tncm91cFN0YWNrLmxlbmd0aCAtIDFdID09IFwiQlJBQ0VcIikge1xuICAgICAgICBncm91cFN0YWNrLnBvcCgpO1xuICAgICAgICBzZWdtZW50ICs9IFwiKVwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCIsXCIgJiYgZ3JvdXBTdGFja1tncm91cFN0YWNrLmxlbmd0aCAtIDFdID09IFwiQlJBQ0VcIikge1xuICAgICAgICBzZWdtZW50ICs9IFwifFwiO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGdsb2JbaV0gPT0gXCIqXCIpIHtcbiAgICAgICAgaWYgKGV4dGVuZGVkICYmIGdsb2JbaSArIDFdID09IFwiKFwiKSB7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGdyb3VwU3RhY2sucHVzaChcIipcIik7XG4gICAgICAgICAgc2VnbWVudCArPSBcIig/OlwiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHByZXZDaGFyID0gZ2xvYltpIC0gMV07XG4gICAgICAgICAgbGV0IG51bVN0YXJzID0gMTtcbiAgICAgICAgICB3aGlsZSAoZ2xvYltpICsgMV0gPT0gXCIqXCIpIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIG51bVN0YXJzKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IG5leHRDaGFyID0gZ2xvYltpICsgMV07XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgZ2xvYnN0YXJPcHRpb24gJiYgbnVtU3RhcnMgPT0gMiAmJlxuICAgICAgICAgICAgWy4uLnNlcHMsIHVuZGVmaW5lZF0uaW5jbHVkZXMocHJldkNoYXIpICYmXG4gICAgICAgICAgICBbLi4uc2VwcywgdW5kZWZpbmVkXS5pbmNsdWRlcyhuZXh0Q2hhcilcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHNlZ21lbnQgKz0gZ2xvYnN0YXI7XG4gICAgICAgICAgICBlbmRzV2l0aFNlcCA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlZ21lbnQgKz0gd2lsZGNhcmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBzZWdtZW50ICs9IHJlZ0V4cEVzY2FwZUNoYXJzLmluY2x1ZGVzKGdsb2JbaV0pID8gYFxcXFwke2dsb2JbaV19YCA6IGdsb2JbaV07XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIHVuY2xvc2VkIGdyb3VwcyBvciBhIGRhbmdsaW5nIGJhY2tzbGFzaC5cbiAgICBpZiAoZ3JvdXBTdGFjay5sZW5ndGggPiAwIHx8IGluUmFuZ2UgfHwgaW5Fc2NhcGUpIHtcbiAgICAgIC8vIFBhcnNlIGZhaWx1cmUuIFRha2UgYWxsIGNoYXJhY3RlcnMgZnJvbSB0aGlzIHNlZ21lbnQgbGl0ZXJhbGx5LlxuICAgICAgc2VnbWVudCA9IFwiXCI7XG4gICAgICBmb3IgKGNvbnN0IGMgb2YgZ2xvYi5zbGljZShqLCBpKSkge1xuICAgICAgICBzZWdtZW50ICs9IHJlZ0V4cEVzY2FwZUNoYXJzLmluY2x1ZGVzKGMpID8gYFxcXFwke2N9YCA6IGM7XG4gICAgICAgIGVuZHNXaXRoU2VwID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVnRXhwU3RyaW5nICs9IHNlZ21lbnQ7XG4gICAgaWYgKCFlbmRzV2l0aFNlcCkge1xuICAgICAgcmVnRXhwU3RyaW5nICs9IGkgPCBnbG9iLmxlbmd0aCA/IHNlcCA6IHNlcE1heWJlO1xuICAgICAgZW5kc1dpdGhTZXAgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIFRlcm1pbmF0ZXMgd2l0aCBgaWAgYXQgdGhlIHN0YXJ0IG9mIHRoZSBuZXh0IHNlZ21lbnQuXG4gICAgd2hpbGUgKHNlcHMuaW5jbHVkZXMoZ2xvYltpXSkpIGkrKztcblxuICAgIC8vIENoZWNrIHRoYXQgdGhlIG5leHQgdmFsdWUgb2YgYGpgIGlzIGluZGVlZCBoaWdoZXIgdGhhbiB0aGUgY3VycmVudCB2YWx1ZS5cbiAgICBpZiAoIShpID4gaikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkFzc2VydGlvbiBmYWlsdXJlOiBpID4gaiAocG90ZW50aWFsIGluZmluaXRlIGxvb3ApXCIpO1xuICAgIH1cbiAgICBqID0gaTtcbiAgfVxuXG4gIHJlZ0V4cFN0cmluZyA9IGBeJHtyZWdFeHBTdHJpbmd9JGA7XG4gIHJldHVybiBuZXcgUmVnRXhwKHJlZ0V4cFN0cmluZywgY2FzZUluc2Vuc2l0aXZlID8gXCJpXCIgOiBcIlwiKTtcbn1cblxuLyoqIFRlc3Qgd2hldGhlciB0aGUgZ2l2ZW4gc3RyaW5nIGlzIGEgZ2xvYiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzR2xvYihzdHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBjaGFyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgXCJ7XCI6IFwifVwiLCBcIihcIjogXCIpXCIsIFwiW1wiOiBcIl1cIiB9O1xuICBjb25zdCByZWdleCA9XG4gICAgL1xcXFwoLil8KF4hfFxcKnxcXD98W1xcXS4rKV1cXD98XFxbW15cXFxcXFxdXStcXF18XFx7W15cXFxcfV0rXFx9fFxcKFxcP1s6IT1dW15cXFxcKV0rXFwpfFxcKFtefF0rXFx8W15cXFxcKV0rXFwpKS87XG5cbiAgaWYgKHN0ciA9PT0gXCJcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGxldCBtYXRjaDogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcblxuICB3aGlsZSAoKG1hdGNoID0gcmVnZXguZXhlYyhzdHIpKSkge1xuICAgIGlmIChtYXRjaFsyXSkgcmV0dXJuIHRydWU7XG4gICAgbGV0IGlkeCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuXG4gICAgLy8gaWYgYW4gb3BlbiBicmFja2V0L2JyYWNlL3BhcmVuIGlzIGVzY2FwZWQsXG4gICAgLy8gc2V0IHRoZSBpbmRleCB0byB0aGUgbmV4dCBjbG9zaW5nIGNoYXJhY3RlclxuICAgIGNvbnN0IG9wZW4gPSBtYXRjaFsxXTtcbiAgICBjb25zdCBjbG9zZSA9IG9wZW4gPyBjaGFyc1tvcGVuXSA6IG51bGw7XG4gICAgaWYgKG9wZW4gJiYgY2xvc2UpIHtcbiAgICAgIGNvbnN0IG4gPSBzdHIuaW5kZXhPZihjbG9zZSwgaWR4KTtcbiAgICAgIGlmIChuICE9PSAtMSkge1xuICAgICAgICBpZHggPSBuICsgMTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdHIgPSBzdHIuc2xpY2UoaWR4KTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqIExpa2Ugbm9ybWFsaXplKCksIGJ1dCBkb2Vzbid0IGNvbGxhcHNlIFwiKipcXC8uLlwiIHdoZW4gYGdsb2JzdGFyYCBpcyB0cnVlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUdsb2IoXG4gIGdsb2I6IHN0cmluZyxcbiAgeyBnbG9ic3RhciA9IGZhbHNlIH06IEdsb2JPcHRpb25zID0ge30sXG4pOiBzdHJpbmcge1xuICBpZiAoZ2xvYi5tYXRjaCgvXFwwL2cpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBHbG9iIGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVyczogXCIke2dsb2J9XCJgKTtcbiAgfVxuICBpZiAoIWdsb2JzdGFyKSB7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZShnbG9iKTtcbiAgfVxuICBjb25zdCBzID0gU0VQX1BBVFRFUk4uc291cmNlO1xuICBjb25zdCBiYWRQYXJlbnRQYXR0ZXJuID0gbmV3IFJlZ0V4cChcbiAgICBgKD88PSgke3N9fF4pXFxcXCpcXFxcKiR7c30pXFxcXC5cXFxcLig/PSR7c318JClgLFxuICAgIFwiZ1wiLFxuICApO1xuICByZXR1cm4gbm9ybWFsaXplKGdsb2IucmVwbGFjZShiYWRQYXJlbnRQYXR0ZXJuLCBcIlxcMFwiKSkucmVwbGFjZSgvXFwwL2csIFwiLi5cIik7XG59XG5cbi8qKiBMaWtlIGpvaW4oKSwgYnV0IGRvZXNuJ3QgY29sbGFwc2UgXCIqKlxcLy4uXCIgd2hlbiBgZ2xvYnN0YXJgIGlzIHRydWUuICovXG5leHBvcnQgZnVuY3Rpb24gam9pbkdsb2JzKFxuICBnbG9iczogc3RyaW5nW10sXG4gIHsgZXh0ZW5kZWQgPSB0cnVlLCBnbG9ic3RhciA9IGZhbHNlIH06IEdsb2JPcHRpb25zID0ge30sXG4pOiBzdHJpbmcge1xuICBpZiAoIWdsb2JzdGFyIHx8IGdsb2JzLmxlbmd0aCA9PSAwKSB7XG4gICAgcmV0dXJuIGpvaW4oLi4uZ2xvYnMpO1xuICB9XG4gIGlmIChnbG9icy5sZW5ndGggPT09IDApIHJldHVybiBcIi5cIjtcbiAgbGV0IGpvaW5lZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBmb3IgKGNvbnN0IGdsb2Igb2YgZ2xvYnMpIHtcbiAgICBjb25zdCBwYXRoID0gZ2xvYjtcbiAgICBpZiAocGF0aC5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoIWpvaW5lZCkgam9pbmVkID0gcGF0aDtcbiAgICAgIGVsc2Ugam9pbmVkICs9IGAke1NFUH0ke3BhdGh9YDtcbiAgICB9XG4gIH1cbiAgaWYgKCFqb2luZWQpIHJldHVybiBcIi5cIjtcbiAgcmV0dXJuIG5vcm1hbGl6ZUdsb2Ioam9pbmVkLCB7IGV4dGVuZGVkLCBnbG9ic3RhciB9KTtcbn1cbiIsIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgdGhlIEJyb3dzZXJpZnkgYXV0aG9ycy4gTUlUIExpY2Vuc2UuXG5cbi8qKlxuICogUG9ydGVkIG1vc3RseSBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9icm93c2VyaWZ5L3BhdGgtYnJvd3NlcmlmeS9cbiAqIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cbiAqIEBtb2R1bGVcbiAqL1xuXG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tIFwiLi4vX3V0aWwvb3MudHNcIjtcbmltcG9ydCAqIGFzIF93aW4zMiBmcm9tIFwiLi93aW4zMi50c1wiO1xuaW1wb3J0ICogYXMgX3Bvc2l4IGZyb20gXCIuL3Bvc2l4LnRzXCI7XG5cbmNvbnN0IHBhdGggPSBpc1dpbmRvd3MgPyBfd2luMzIgOiBfcG9zaXg7XG5cbmV4cG9ydCBjb25zdCB3aW4zMiA9IF93aW4zMjtcbmV4cG9ydCBjb25zdCBwb3NpeCA9IF9wb3NpeDtcbmV4cG9ydCBjb25zdCB7XG4gIGJhc2VuYW1lLFxuICBkZWxpbWl0ZXIsXG4gIGRpcm5hbWUsXG4gIGV4dG5hbWUsXG4gIGZvcm1hdCxcbiAgZnJvbUZpbGVVcmwsXG4gIGlzQWJzb2x1dGUsXG4gIGpvaW4sXG4gIG5vcm1hbGl6ZSxcbiAgcGFyc2UsXG4gIHJlbGF0aXZlLFxuICByZXNvbHZlLFxuICBzZXAsXG4gIHRvRmlsZVVybCxcbiAgdG9OYW1lc3BhY2VkUGF0aCxcbn0gPSBwYXRoO1xuXG5leHBvcnQgKiBmcm9tIFwiLi9jb21tb24udHNcIjtcbmV4cG9ydCB7IFNFUCwgU0VQX1BBVFRFUk4gfSBmcm9tIFwiLi9zZXBhcmF0b3IudHNcIjtcbmV4cG9ydCAqIGZyb20gXCIuL19pbnRlcmZhY2UudHNcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2dsb2IudHNcIjtcbiIsIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gXCIuLi9pby9idWZmZXIudHNcIjtcblxuY29uc3QgREVGQVVMVF9DSFVOS19TSVpFID0gMTZfNjQwO1xuY29uc3QgREVGQVVMVF9CVUZGRVJfU0laRSA9IDMyICogMTAyNDtcblxuZnVuY3Rpb24gaXNDbG9zZXIodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBEZW5vLkNsb3NlciB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiYgdmFsdWUgIT0gbnVsbCAmJiBcImNsb3NlXCIgaW4gdmFsdWUgJiZcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHR5cGVvZiAodmFsdWUgYXMgUmVjb3JkPHN0cmluZywgYW55PilbXCJjbG9zZVwiXSA9PT0gXCJmdW5jdGlvblwiO1xufVxuXG4vKiogQ3JlYXRlIGEgYERlbm8uUmVhZGVyYCBmcm9tIGFuIGl0ZXJhYmxlIG9mIGBVaW50OEFycmF5YHMuXG4gKlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgcmVhZGVyRnJvbUl0ZXJhYmxlIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuICpcbiAqICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IERlbm8ub3BlbihcIm1ldHJpY3MudHh0XCIsIHsgd3JpdGU6IHRydWUgfSk7XG4gKiAgICAgIGNvbnN0IHJlYWRlciA9IHJlYWRlckZyb21JdGVyYWJsZSgoYXN5bmMgZnVuY3Rpb24qICgpIHtcbiAqICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICogICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCkpO1xuICogICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBkYXRhOiAke0pTT04uc3RyaW5naWZ5KERlbm8ubWV0cmljcygpKX1cXG5cXG5gO1xuICogICAgICAgICAgeWllbGQgbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKG1lc3NhZ2UpO1xuICogICAgICAgIH1cbiAqICAgICAgfSkoKSk7XG4gKiAgICAgIGF3YWl0IERlbm8uY29weShyZWFkZXIsIGZpbGUpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkZXJGcm9tSXRlcmFibGUoXG4gIGl0ZXJhYmxlOiBJdGVyYWJsZTxVaW50OEFycmF5PiB8IEFzeW5jSXRlcmFibGU8VWludDhBcnJheT4sXG4pOiBEZW5vLlJlYWRlciB7XG4gIGNvbnN0IGl0ZXJhdG9yOiBJdGVyYXRvcjxVaW50OEFycmF5PiB8IEFzeW5jSXRlcmF0b3I8VWludDhBcnJheT4gPVxuICAgIChpdGVyYWJsZSBhcyBBc3luY0l0ZXJhYmxlPFVpbnQ4QXJyYXk+KVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0/LigpID8/XG4gICAgICAoaXRlcmFibGUgYXMgSXRlcmFibGU8VWludDhBcnJheT4pW1N5bWJvbC5pdGVyYXRvcl0/LigpO1xuICBjb25zdCBidWZmZXIgPSBuZXcgQnVmZmVyKCk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgcmVhZChwOiBVaW50OEFycmF5KTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgICBpZiAoYnVmZmVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgaWYgKHJlc3VsdC5kb25lKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHJlc3VsdC52YWx1ZS5ieXRlTGVuZ3RoIDw9IHAuYnl0ZUxlbmd0aCkge1xuICAgICAgICAgICAgcC5zZXQocmVzdWx0LnZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQudmFsdWUuYnl0ZUxlbmd0aDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcC5zZXQocmVzdWx0LnZhbHVlLnN1YmFycmF5KDAsIHAuYnl0ZUxlbmd0aCkpO1xuICAgICAgICAgIGF3YWl0IHdyaXRlQWxsKGJ1ZmZlciwgcmVzdWx0LnZhbHVlLnN1YmFycmF5KHAuYnl0ZUxlbmd0aCkpO1xuICAgICAgICAgIHJldHVybiBwLmJ5dGVMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG4gPSBhd2FpdCBidWZmZXIucmVhZChwKTtcbiAgICAgICAgaWYgKG4gPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlYWQocCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG47XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cblxuLyoqIENyZWF0ZSBhIGBXcml0ZXJgIGZyb20gYSBgV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZXJGcm9tU3RyZWFtV3JpdGVyKFxuICBzdHJlYW1Xcml0ZXI6IFdyaXRhYmxlU3RyZWFtRGVmYXVsdFdyaXRlcjxVaW50OEFycmF5Pixcbik6IERlbm8uV3JpdGVyIHtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyB3cml0ZShwOiBVaW50OEFycmF5KTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICAgIGF3YWl0IHN0cmVhbVdyaXRlci5yZWFkeTtcbiAgICAgIGF3YWl0IHN0cmVhbVdyaXRlci53cml0ZShwKTtcbiAgICAgIHJldHVybiBwLmxlbmd0aDtcbiAgICB9LFxuICB9O1xufVxuXG4vKiogQ3JlYXRlIGEgYFJlYWRlcmAgZnJvbSBhIGBSZWFkYWJsZVN0cmVhbURlZmF1bHRSZWFkZXJgLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRlckZyb21TdHJlYW1SZWFkZXIoXG4gIHN0cmVhbVJlYWRlcjogUmVhZGFibGVTdHJlYW1EZWZhdWx0UmVhZGVyPFVpbnQ4QXJyYXk+LFxuKTogRGVuby5SZWFkZXIge1xuICBjb25zdCBidWZmZXIgPSBuZXcgQnVmZmVyKCk7XG5cbiAgcmV0dXJuIHtcbiAgICBhc3luYyByZWFkKHA6IFVpbnQ4QXJyYXkpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICAgIGlmIChidWZmZXIuZW1wdHkoKSkge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBzdHJlYW1SZWFkZXIucmVhZCgpO1xuICAgICAgICBpZiAocmVzLmRvbmUpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDsgLy8gRU9GXG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB3cml0ZUFsbChidWZmZXIsIHJlcy52YWx1ZSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBidWZmZXIucmVhZChwKTtcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFdyaXRhYmxlU3RyZWFtRnJvbVdyaXRlck9wdGlvbnMge1xuICAvKipcbiAgICogSWYgdGhlIGB3cml0ZXJgIGlzIGFsc28gYSBgRGVuby5DbG9zZXJgLCBhdXRvbWF0aWNhbGx5IGNsb3NlIHRoZSBgd3JpdGVyYFxuICAgKiB3aGVuIHRoZSBzdHJlYW0gaXMgY2xvc2VkLCBhYm9ydGVkLCBvciBhIHdyaXRlIGVycm9yIG9jY3Vycy5cbiAgICpcbiAgICogRGVmYXVsdHMgdG8gYHRydWVgLiAqL1xuICBhdXRvQ2xvc2U/OiBib29sZWFuO1xufVxuXG4vKiogQ3JlYXRlIGEgYFdyaXRhYmxlU3RyZWFtYCBmcm9tIGEgYFdyaXRlcmAuICovXG5leHBvcnQgZnVuY3Rpb24gd3JpdGFibGVTdHJlYW1Gcm9tV3JpdGVyKFxuICB3cml0ZXI6IERlbm8uV3JpdGVyLFxuICBvcHRpb25zOiBXcml0YWJsZVN0cmVhbUZyb21Xcml0ZXJPcHRpb25zID0ge30sXG4pOiBXcml0YWJsZVN0cmVhbTxVaW50OEFycmF5PiB7XG4gIGNvbnN0IHsgYXV0b0Nsb3NlID0gdHJ1ZSB9ID0gb3B0aW9ucztcblxuICByZXR1cm4gbmV3IFdyaXRhYmxlU3RyZWFtKHtcbiAgICBhc3luYyB3cml0ZShjaHVuaywgY29udHJvbGxlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgd3JpdGVBbGwod3JpdGVyLCBjaHVuayk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnRyb2xsZXIuZXJyb3IoZSk7XG4gICAgICAgIGlmIChpc0Nsb3Nlcih3cml0ZXIpICYmIGF1dG9DbG9zZSkge1xuICAgICAgICAgIHdyaXRlci5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBjbG9zZSgpIHtcbiAgICAgIGlmIChpc0Nsb3Nlcih3cml0ZXIpICYmIGF1dG9DbG9zZSkge1xuICAgICAgICB3cml0ZXIuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGFib3J0KCkge1xuICAgICAgaWYgKGlzQ2xvc2VyKHdyaXRlcikgJiYgYXV0b0Nsb3NlKSB7XG4gICAgICAgIHdyaXRlci5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0sXG4gIH0pO1xufVxuXG4vKiogQ3JlYXRlIGEgYFJlYWRhYmxlU3RyZWFtYCBmcm9tIGFueSBraW5kIG9mIGl0ZXJhYmxlLlxuICpcbiAqIGBgYHRzXG4gKiAgICAgIGltcG9ydCB7IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuICpcbiAqICAgICAgY29uc3QgcjEgPSByZWFkYWJsZVN0cmVhbUZyb21JdGVyYWJsZShbXCJmb28sIGJhciwgYmF6XCJdKTtcbiAqICAgICAgY29uc3QgcjIgPSByZWFkYWJsZVN0cmVhbUZyb21JdGVyYWJsZShhc3luYyBmdW5jdGlvbiogKCkge1xuICogICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKCgocikgPT4gc2V0VGltZW91dChyLCAxMDAwKSkpO1xuICogICAgICAgIHlpZWxkIFwiZm9vXCI7XG4gKiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDApKSk7XG4gKiAgICAgICAgeWllbGQgXCJiYXJcIjtcbiAqICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCkpKTtcbiAqICAgICAgICB5aWVsZCBcImJhelwiO1xuICogICAgICB9KCkpO1xuICogYGBgXG4gKlxuICogSWYgdGhlIHByb2R1Y2VkIGl0ZXJhdG9yIChgaXRlcmFibGVbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKClgIG9yXG4gKiBgaXRlcmFibGVbU3ltYm9sLml0ZXJhdG9yXSgpYCkgaXMgYSBnZW5lcmF0b3IsIG9yIG1vcmUgc3BlY2lmaWNhbGx5IGlzIGZvdW5kXG4gKiB0byBoYXZlIGEgYC50aHJvdygpYCBtZXRob2Qgb24gaXQsIHRoYXQgd2lsbCBiZSBjYWxsZWQgdXBvblxuICogYHJlYWRhYmxlU3RyZWFtLmNhbmNlbCgpYC4gVGhpcyBpcyB0aGUgY2FzZSBmb3IgdGhlIHNlY29uZCBpbnB1dCB0eXBlIGFib3ZlOlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyByZWFkYWJsZVN0cmVhbUZyb21JdGVyYWJsZSB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiBjb25zdCByMyA9IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlKGFzeW5jIGZ1bmN0aW9uKiAoKSB7XG4gKiAgIHRyeSB7XG4gKiAgICAgeWllbGQgXCJmb29cIjtcbiAqICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgICBjb25zb2xlLmxvZyhlcnJvcik7IC8vIEVycm9yOiBDYW5jZWxsZWQgYnkgY29uc3VtZXIuXG4gKiAgIH1cbiAqIH0oKSk7XG4gKiBjb25zdCByZWFkZXIgPSByMy5nZXRSZWFkZXIoKTtcbiAqIGNvbnNvbGUubG9nKGF3YWl0IHJlYWRlci5yZWFkKCkpOyAvLyB7IHZhbHVlOiBcImZvb1wiLCBkb25lOiBmYWxzZSB9XG4gKiBhd2FpdCByZWFkZXIuY2FuY2VsKG5ldyBFcnJvcihcIkNhbmNlbGxlZCBieSBjb25zdW1lci5cIikpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkYWJsZVN0cmVhbUZyb21JdGVyYWJsZTxUPihcbiAgaXRlcmFibGU6IEl0ZXJhYmxlPFQ+IHwgQXN5bmNJdGVyYWJsZTxUPixcbik6IFJlYWRhYmxlU3RyZWFtPFQ+IHtcbiAgY29uc3QgaXRlcmF0b3I6IEl0ZXJhdG9yPFQ+IHwgQXN5bmNJdGVyYXRvcjxUPiA9XG4gICAgKGl0ZXJhYmxlIGFzIEFzeW5jSXRlcmFibGU8VD4pW1N5bWJvbC5hc3luY0l0ZXJhdG9yXT8uKCkgPz9cbiAgICAgIChpdGVyYWJsZSBhcyBJdGVyYWJsZTxUPilbU3ltYm9sLml0ZXJhdG9yXT8uKCk7XG4gIHJldHVybiBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgIGFzeW5jIHB1bGwoY29udHJvbGxlcikge1xuICAgICAgY29uc3QgeyB2YWx1ZSwgZG9uZSB9ID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgY29udHJvbGxlci5jbG9zZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGFzeW5jIGNhbmNlbChyZWFzb24pIHtcbiAgICAgIGlmICh0eXBlb2YgaXRlcmF0b3IudGhyb3cgPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgaXRlcmF0b3IudGhyb3cocmVhc29uKTtcbiAgICAgICAgfSBjYXRjaCB7IC8qIGBpdGVyYXRvci50aHJvdygpYCBhbHdheXMgdGhyb3dzIG9uIHNpdGUuIFdlIGNhdGNoIGl0LiAqLyB9XG4gICAgICB9XG4gICAgfSxcbiAgfSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGFibGVTdHJlYW1Gcm9tUmVhZGVyT3B0aW9ucyB7XG4gIC8qKiBJZiB0aGUgYHJlYWRlcmAgaXMgYWxzbyBhIGBEZW5vLkNsb3NlcmAsIGF1dG9tYXRpY2FsbHkgY2xvc2UgdGhlIGByZWFkZXJgXG4gICAqIHdoZW4gYEVPRmAgaXMgZW5jb3VudGVyZWQsIG9yIGEgcmVhZCBlcnJvciBvY2N1cnMuXG4gICAqXG4gICAqIERlZmF1bHRzIHRvIGB0cnVlYC4gKi9cbiAgYXV0b0Nsb3NlPzogYm9vbGVhbjtcblxuICAvKiogVGhlIHNpemUgb2YgY2h1bmtzIHRvIGFsbG9jYXRlIHRvIHJlYWQsIHRoZSBkZWZhdWx0IGlzIH4xNktpQiwgd2hpY2ggaXNcbiAgICogdGhlIG1heGltdW0gc2l6ZSB0aGF0IERlbm8gb3BlcmF0aW9ucyBjYW4gY3VycmVudGx5IHN1cHBvcnQuICovXG4gIGNodW5rU2l6ZT86IG51bWJlcjtcblxuICAvKiogVGhlIHF1ZXVpbmcgc3RyYXRlZ3kgdG8gY3JlYXRlIHRoZSBgUmVhZGFibGVTdHJlYW1gIHdpdGguICovXG4gIHN0cmF0ZWd5PzogeyBoaWdoV2F0ZXJNYXJrPzogbnVtYmVyIHwgdW5kZWZpbmVkOyBzaXplPzogdW5kZWZpbmVkIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYFJlYWRhYmxlU3RyZWFtPFVpbnQ4QXJyYXk+YCBmcm9tIGZyb20gYSBgRGVuby5SZWFkZXJgLlxuICpcbiAqIFdoZW4gdGhlIHB1bGwgYWxnb3JpdGhtIGlzIGNhbGxlZCBvbiB0aGUgc3RyZWFtLCBhIGNodW5rIGZyb20gdGhlIHJlYWRlclxuICogd2lsbCBiZSByZWFkLiAgV2hlbiBgbnVsbGAgaXMgcmV0dXJuZWQgZnJvbSB0aGUgcmVhZGVyLCB0aGUgc3RyZWFtIHdpbGwgYmVcbiAqIGNsb3NlZCBhbG9uZyB3aXRoIHRoZSByZWFkZXIgKGlmIGl0IGlzIGFsc28gYSBgRGVuby5DbG9zZXJgKS5cbiAqXG4gKiBBbiBleGFtcGxlIGNvbnZlcnRpbmcgYSBgRGVuby5Gc0ZpbGVgIGludG8gYSByZWFkYWJsZSBzdHJlYW06XG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlciB9IGZyb20gXCIuL21vZC50c1wiO1xuICpcbiAqIGNvbnN0IGZpbGUgPSBhd2FpdCBEZW5vLm9wZW4oXCIuL2ZpbGUudHh0XCIsIHsgcmVhZDogdHJ1ZSB9KTtcbiAqIGNvbnN0IGZpbGVTdHJlYW0gPSByZWFkYWJsZVN0cmVhbUZyb21SZWFkZXIoZmlsZSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlcihcbiAgcmVhZGVyOiBEZW5vLlJlYWRlciB8IChEZW5vLlJlYWRlciAmIERlbm8uQ2xvc2VyKSxcbiAgb3B0aW9uczogUmVhZGFibGVTdHJlYW1Gcm9tUmVhZGVyT3B0aW9ucyA9IHt9LFxuKTogUmVhZGFibGVTdHJlYW08VWludDhBcnJheT4ge1xuICBjb25zdCB7XG4gICAgYXV0b0Nsb3NlID0gdHJ1ZSxcbiAgICBjaHVua1NpemUgPSBERUZBVUxUX0NIVU5LX1NJWkUsXG4gICAgc3RyYXRlZ3ksXG4gIH0gPSBvcHRpb25zO1xuXG4gIHJldHVybiBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgIGFzeW5jIHB1bGwoY29udHJvbGxlcikge1xuICAgICAgY29uc3QgY2h1bmsgPSBuZXcgVWludDhBcnJheShjaHVua1NpemUpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVhZCA9IGF3YWl0IHJlYWRlci5yZWFkKGNodW5rKTtcbiAgICAgICAgaWYgKHJlYWQgPT09IG51bGwpIHtcbiAgICAgICAgICBpZiAoaXNDbG9zZXIocmVhZGVyKSAmJiBhdXRvQ2xvc2UpIHtcbiAgICAgICAgICAgIHJlYWRlci5jbG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShjaHVuay5zdWJhcnJheSgwLCByZWFkKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnRyb2xsZXIuZXJyb3IoZSk7XG4gICAgICAgIGlmIChpc0Nsb3NlcihyZWFkZXIpKSB7XG4gICAgICAgICAgcmVhZGVyLmNsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGNhbmNlbCgpIHtcbiAgICAgIGlmIChpc0Nsb3NlcihyZWFkZXIpICYmIGF1dG9DbG9zZSkge1xuICAgICAgICByZWFkZXIuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9LFxuICB9LCBzdHJhdGVneSk7XG59XG5cbi8qKiBSZWFkIFJlYWRlciBgcmAgdW50aWwgRU9GIChgbnVsbGApIGFuZCByZXNvbHZlIHRvIHRoZSBjb250ZW50IGFzXG4gKiBVaW50OEFycmF5YC5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2lvL2J1ZmZlci50c1wiO1xuICogaW1wb3J0IHsgcmVhZEFsbCB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiAvLyBFeGFtcGxlIGZyb20gc3RkaW5cbiAqIGNvbnN0IHN0ZGluQ29udGVudCA9IGF3YWl0IHJlYWRBbGwoRGVuby5zdGRpbik7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIGZpbGVcbiAqIGNvbnN0IGZpbGUgPSBhd2FpdCBEZW5vLm9wZW4oXCJteV9maWxlLnR4dFwiLCB7cmVhZDogdHJ1ZX0pO1xuICogY29uc3QgbXlGaWxlQ29udGVudCA9IGF3YWl0IHJlYWRBbGwoZmlsZSk7XG4gKiBEZW5vLmNsb3NlKGZpbGUucmlkKTtcbiAqXG4gKiAvLyBFeGFtcGxlIGZyb20gYnVmZmVyXG4gKiBjb25zdCBteURhdGEgPSBuZXcgVWludDhBcnJheSgxMDApO1xuICogLy8gLi4uIGZpbGwgbXlEYXRhIGFycmF5IHdpdGggZGF0YVxuICogY29uc3QgcmVhZGVyID0gbmV3IEJ1ZmZlcihteURhdGEuYnVmZmVyKTtcbiAqIGNvbnN0IGJ1ZmZlckNvbnRlbnQgPSBhd2FpdCByZWFkQWxsKHJlYWRlcik7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRBbGwocjogRGVuby5SZWFkZXIpOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3QgYnVmID0gbmV3IEJ1ZmZlcigpO1xuICBhd2FpdCBidWYucmVhZEZyb20ocik7XG4gIHJldHVybiBidWYuYnl0ZXMoKTtcbn1cblxuLyoqIFN5bmNocm9ub3VzbHkgcmVhZHMgUmVhZGVyIGByYCB1bnRpbCBFT0YgKGBudWxsYCkgYW5kIHJldHVybnMgdGhlIGNvbnRlbnRcbiAqIGFzIGBVaW50OEFycmF5YC5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2lvL2J1ZmZlci50c1wiO1xuICogaW1wb3J0IHsgcmVhZEFsbFN5bmMgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIHN0ZGluXG4gKiBjb25zdCBzdGRpbkNvbnRlbnQgPSByZWFkQWxsU3luYyhEZW5vLnN0ZGluKTtcbiAqXG4gKiAvLyBFeGFtcGxlIGZyb20gZmlsZVxuICogY29uc3QgZmlsZSA9IERlbm8ub3BlblN5bmMoXCJteV9maWxlLnR4dFwiLCB7cmVhZDogdHJ1ZX0pO1xuICogY29uc3QgbXlGaWxlQ29udGVudCA9IHJlYWRBbGxTeW5jKGZpbGUpO1xuICogRGVuby5jbG9zZShmaWxlLnJpZCk7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIGJ1ZmZlclxuICogY29uc3QgbXlEYXRhID0gbmV3IFVpbnQ4QXJyYXkoMTAwKTtcbiAqIC8vIC4uLiBmaWxsIG15RGF0YSBhcnJheSB3aXRoIGRhdGFcbiAqIGNvbnN0IHJlYWRlciA9IG5ldyBCdWZmZXIobXlEYXRhLmJ1ZmZlcik7XG4gKiBjb25zdCBidWZmZXJDb250ZW50ID0gcmVhZEFsbFN5bmMocmVhZGVyKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFsbFN5bmMocjogRGVuby5SZWFkZXJTeW5jKTogVWludDhBcnJheSB7XG4gIGNvbnN0IGJ1ZiA9IG5ldyBCdWZmZXIoKTtcbiAgYnVmLnJlYWRGcm9tU3luYyhyKTtcbiAgcmV0dXJuIGJ1Zi5ieXRlcygpO1xufVxuXG4vKiogV3JpdGUgYWxsIHRoZSBjb250ZW50IG9mIHRoZSBhcnJheSBidWZmZXIgKGBhcnJgKSB0byB0aGUgd3JpdGVyIChgd2ApLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vaW8vYnVmZmVyLnRzXCI7XG4gKiBpbXBvcnQgeyB3cml0ZUFsbCB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcblxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIHN0ZG91dFxuICogbGV0IGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogYXdhaXQgd3JpdGVBbGwoRGVuby5zdGRvdXQsIGNvbnRlbnRCeXRlcyk7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIGZpbGVcbiAqIGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogY29uc3QgZmlsZSA9IGF3YWl0IERlbm8ub3BlbigndGVzdC5maWxlJywge3dyaXRlOiB0cnVlfSk7XG4gKiBhd2FpdCB3cml0ZUFsbChmaWxlLCBjb250ZW50Qnl0ZXMpO1xuICogRGVuby5jbG9zZShmaWxlLnJpZCk7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIGJ1ZmZlclxuICogY29udGVudEJ5dGVzID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKFwiSGVsbG8gV29ybGRcIik7XG4gKiBjb25zdCB3cml0ZXIgPSBuZXcgQnVmZmVyKCk7XG4gKiBhd2FpdCB3cml0ZUFsbCh3cml0ZXIsIGNvbnRlbnRCeXRlcyk7XG4gKiBjb25zb2xlLmxvZyh3cml0ZXIuYnl0ZXMoKS5sZW5ndGgpOyAgLy8gMTFcbiAqIGBgYFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVBbGwodzogRGVuby5Xcml0ZXIsIGFycjogVWludDhBcnJheSkge1xuICBsZXQgbndyaXR0ZW4gPSAwO1xuICB3aGlsZSAobndyaXR0ZW4gPCBhcnIubGVuZ3RoKSB7XG4gICAgbndyaXR0ZW4gKz0gYXdhaXQgdy53cml0ZShhcnIuc3ViYXJyYXkobndyaXR0ZW4pKTtcbiAgfVxufVxuXG4vKiogU3luY2hyb25vdXNseSB3cml0ZSBhbGwgdGhlIGNvbnRlbnQgb2YgdGhlIGFycmF5IGJ1ZmZlciAoYGFycmApIHRvIHRoZVxuICogd3JpdGVyIChgd2ApLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vaW8vYnVmZmVyLnRzXCI7XG4gKiBpbXBvcnQgeyB3cml0ZUFsbFN5bmMgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIHN0ZG91dFxuICogbGV0IGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogd3JpdGVBbGxTeW5jKERlbm8uc3Rkb3V0LCBjb250ZW50Qnl0ZXMpO1xuICpcbiAqIC8vIEV4YW1wbGUgd3JpdGluZyB0byBmaWxlXG4gKiBjb250ZW50Qnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoXCJIZWxsbyBXb3JsZFwiKTtcbiAqIGNvbnN0IGZpbGUgPSBEZW5vLm9wZW5TeW5jKCd0ZXN0LmZpbGUnLCB7d3JpdGU6IHRydWV9KTtcbiAqIHdyaXRlQWxsU3luYyhmaWxlLCBjb250ZW50Qnl0ZXMpO1xuICogRGVuby5jbG9zZShmaWxlLnJpZCk7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIGJ1ZmZlclxuICogY29udGVudEJ5dGVzID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKFwiSGVsbG8gV29ybGRcIik7XG4gKiBjb25zdCB3cml0ZXIgPSBuZXcgQnVmZmVyKCk7XG4gKiB3cml0ZUFsbFN5bmMod3JpdGVyLCBjb250ZW50Qnl0ZXMpO1xuICogY29uc29sZS5sb2cod3JpdGVyLmJ5dGVzKCkubGVuZ3RoKTsgIC8vIDExXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQWxsU3luYyh3OiBEZW5vLldyaXRlclN5bmMsIGFycjogVWludDhBcnJheSk6IHZvaWQge1xuICBsZXQgbndyaXR0ZW4gPSAwO1xuICB3aGlsZSAobndyaXR0ZW4gPCBhcnIubGVuZ3RoKSB7XG4gICAgbndyaXR0ZW4gKz0gdy53cml0ZVN5bmMoYXJyLnN1YmFycmF5KG53cml0dGVuKSk7XG4gIH1cbn1cblxuLyoqIFR1cm5zIGEgUmVhZGVyLCBgcmAsIGludG8gYW4gYXN5bmMgaXRlcmF0b3IuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGl0ZXJhdGVSZWFkZXIgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogbGV0IGYgPSBhd2FpdCBEZW5vLm9wZW4oXCIvZXRjL3Bhc3N3ZFwiKTtcbiAqIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgaXRlcmF0ZVJlYWRlcihmKSkge1xuICogICBjb25zb2xlLmxvZyhjaHVuayk7XG4gKiB9XG4gKiBmLmNsb3NlKCk7XG4gKiBgYGBcbiAqXG4gKiBTZWNvbmQgYXJndW1lbnQgY2FuIGJlIHVzZWQgdG8gdHVuZSBzaXplIG9mIGEgYnVmZmVyLlxuICogRGVmYXVsdCBzaXplIG9mIHRoZSBidWZmZXIgaXMgMzJrQi5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgaXRlcmF0ZVJlYWRlciB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiBsZXQgZiA9IGF3YWl0IERlbm8ub3BlbihcIi9ldGMvcGFzc3dkXCIpO1xuICogY29uc3QgaXQgPSBpdGVyYXRlUmVhZGVyKGYsIHtcbiAqICAgYnVmU2l6ZTogMTAyNCAqIDEwMjRcbiAqIH0pO1xuICogZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBpdCkge1xuICogICBjb25zb2xlLmxvZyhjaHVuayk7XG4gKiB9XG4gKiBmLmNsb3NlKCk7XG4gKiBgYGBcbiAqXG4gKiBJdGVyYXRvciB1c2VzIGFuIGludGVybmFsIGJ1ZmZlciBvZiBmaXhlZCBzaXplIGZvciBlZmZpY2llbmN5OyBpdCByZXR1cm5zXG4gKiBhIHZpZXcgb24gdGhhdCBidWZmZXIgb24gZWFjaCBpdGVyYXRpb24uIEl0IGlzIHRoZXJlZm9yZSBjYWxsZXInc1xuICogcmVzcG9uc2liaWxpdHkgdG8gY29weSBjb250ZW50cyBvZiB0aGUgYnVmZmVyIGlmIG5lZWRlZDsgb3RoZXJ3aXNlIHRoZVxuICogbmV4dCBpdGVyYXRpb24gd2lsbCBvdmVyd3JpdGUgY29udGVudHMgb2YgcHJldmlvdXNseSByZXR1cm5lZCBjaHVuay5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBpdGVyYXRlUmVhZGVyKFxuICByOiBEZW5vLlJlYWRlcixcbiAgb3B0aW9ucz86IHtcbiAgICBidWZTaXplPzogbnVtYmVyO1xuICB9LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3QgYnVmU2l6ZSA9IG9wdGlvbnM/LmJ1ZlNpemUgPz8gREVGQVVMVF9CVUZGRVJfU0laRTtcbiAgY29uc3QgYiA9IG5ldyBVaW50OEFycmF5KGJ1ZlNpemUpO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHIucmVhZChiKTtcbiAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICB5aWVsZCBiLnN1YmFycmF5KDAsIHJlc3VsdCk7XG4gIH1cbn1cblxuLyoqIFR1cm5zIGEgUmVhZGVyU3luYywgYHJgLCBpbnRvIGFuIGl0ZXJhdG9yLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBpdGVyYXRlUmVhZGVyU3luYyB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiBsZXQgZiA9IERlbm8ub3BlblN5bmMoXCIvZXRjL3Bhc3N3ZFwiKTtcbiAqIGZvciAoY29uc3QgY2h1bmsgb2YgaXRlcmF0ZVJlYWRlclN5bmMoZikpIHtcbiAqICAgY29uc29sZS5sb2coY2h1bmspO1xuICogfVxuICogZi5jbG9zZSgpO1xuICogYGBgXG4gKlxuICogU2Vjb25kIGFyZ3VtZW50IGNhbiBiZSB1c2VkIHRvIHR1bmUgc2l6ZSBvZiBhIGJ1ZmZlci5cbiAqIERlZmF1bHQgc2l6ZSBvZiB0aGUgYnVmZmVyIGlzIDMya0IuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGl0ZXJhdGVSZWFkZXJTeW5jIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuXG4gKiBsZXQgZiA9IGF3YWl0IERlbm8ub3BlbihcIi9ldGMvcGFzc3dkXCIpO1xuICogY29uc3QgaXRlciA9IGl0ZXJhdGVSZWFkZXJTeW5jKGYsIHtcbiAqICAgYnVmU2l6ZTogMTAyNCAqIDEwMjRcbiAqIH0pO1xuICogZm9yIChjb25zdCBjaHVuayBvZiBpdGVyKSB7XG4gKiAgIGNvbnNvbGUubG9nKGNodW5rKTtcbiAqIH1cbiAqIGYuY2xvc2UoKTtcbiAqIGBgYFxuICpcbiAqIEl0ZXJhdG9yIHVzZXMgYW4gaW50ZXJuYWwgYnVmZmVyIG9mIGZpeGVkIHNpemUgZm9yIGVmZmljaWVuY3k7IGl0IHJldHVybnNcbiAqIGEgdmlldyBvbiB0aGF0IGJ1ZmZlciBvbiBlYWNoIGl0ZXJhdGlvbi4gSXQgaXMgdGhlcmVmb3JlIGNhbGxlcidzXG4gKiByZXNwb25zaWJpbGl0eSB0byBjb3B5IGNvbnRlbnRzIG9mIHRoZSBidWZmZXIgaWYgbmVlZGVkOyBvdGhlcndpc2UgdGhlXG4gKiBuZXh0IGl0ZXJhdGlvbiB3aWxsIG92ZXJ3cml0ZSBjb250ZW50cyBvZiBwcmV2aW91c2x5IHJldHVybmVkIGNodW5rLlxuICovXG5leHBvcnQgZnVuY3Rpb24qIGl0ZXJhdGVSZWFkZXJTeW5jKFxuICByOiBEZW5vLlJlYWRlclN5bmMsXG4gIG9wdGlvbnM/OiB7XG4gICAgYnVmU2l6ZT86IG51bWJlcjtcbiAgfSxcbik6IEl0ZXJhYmxlSXRlcmF0b3I8VWludDhBcnJheT4ge1xuICBjb25zdCBidWZTaXplID0gb3B0aW9ucz8uYnVmU2l6ZSA/PyBERUZBVUxUX0JVRkZFUl9TSVpFO1xuICBjb25zdCBiID0gbmV3IFVpbnQ4QXJyYXkoYnVmU2l6ZSk7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gci5yZWFkU3luYyhiKTtcbiAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICB5aWVsZCBiLnN1YmFycmF5KDAsIHJlc3VsdCk7XG4gIH1cbn1cblxuLyoqIENvcGllcyBmcm9tIGBzcmNgIHRvIGBkc3RgIHVudGlsIGVpdGhlciBFT0YgKGBudWxsYCkgaXMgcmVhZCBmcm9tIGBzcmNgIG9yXG4gKiBhbiBlcnJvciBvY2N1cnMuIEl0IHJlc29sdmVzIHRvIHRoZSBudW1iZXIgb2YgYnl0ZXMgY29waWVkIG9yIHJlamVjdHMgd2l0aFxuICogdGhlIGZpcnN0IGVycm9yIGVuY291bnRlcmVkIHdoaWxlIGNvcHlpbmcuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGNvcHkgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogY29uc3Qgc291cmNlID0gYXdhaXQgRGVuby5vcGVuKFwibXlfZmlsZS50eHRcIik7XG4gKiBjb25zdCBieXRlc0NvcGllZDEgPSBhd2FpdCBjb3B5KHNvdXJjZSwgRGVuby5zdGRvdXQpO1xuICogY29uc3QgZGVzdGluYXRpb24gPSBhd2FpdCBEZW5vLmNyZWF0ZShcIm15X2ZpbGVfMi50eHRcIik7XG4gKiBjb25zdCBieXRlc0NvcGllZDIgPSBhd2FpdCBjb3B5KHNvdXJjZSwgZGVzdGluYXRpb24pO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHNyYyBUaGUgc291cmNlIHRvIGNvcHkgZnJvbVxuICogQHBhcmFtIGRzdCBUaGUgZGVzdGluYXRpb24gdG8gY29weSB0b1xuICogQHBhcmFtIG9wdGlvbnMgQ2FuIGJlIHVzZWQgdG8gdHVuZSBzaXplIG9mIHRoZSBidWZmZXIuIERlZmF1bHQgc2l6ZSBpcyAzMmtCXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb3B5KFxuICBzcmM6IERlbm8uUmVhZGVyLFxuICBkc3Q6IERlbm8uV3JpdGVyLFxuICBvcHRpb25zPzoge1xuICAgIGJ1ZlNpemU/OiBudW1iZXI7XG4gIH0sXG4pOiBQcm9taXNlPG51bWJlcj4ge1xuICBsZXQgbiA9IDA7XG4gIGNvbnN0IGJ1ZlNpemUgPSBvcHRpb25zPy5idWZTaXplID8/IERFRkFVTFRfQlVGRkVSX1NJWkU7XG4gIGNvbnN0IGIgPSBuZXcgVWludDhBcnJheShidWZTaXplKTtcbiAgbGV0IGdvdEVPRiA9IGZhbHNlO1xuICB3aGlsZSAoZ290RU9GID09PSBmYWxzZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNyYy5yZWFkKGIpO1xuICAgIGlmIChyZXN1bHQgPT09IG51bGwpIHtcbiAgICAgIGdvdEVPRiA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBud3JpdHRlbiA9IDA7XG4gICAgICB3aGlsZSAobndyaXR0ZW4gPCByZXN1bHQpIHtcbiAgICAgICAgbndyaXR0ZW4gKz0gYXdhaXQgZHN0LndyaXRlKGIuc3ViYXJyYXkobndyaXR0ZW4sIHJlc3VsdCkpO1xuICAgICAgfVxuICAgICAgbiArPSBud3JpdHRlbjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG47XG59XG4iLCIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgZnJvbUZpbGVVcmwgfSBmcm9tIFwiLi4vLi4vcGF0aC9tb2QudHNcIjtcbmltcG9ydCB7IHJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlciB9IGZyb20gXCIuLi8uLi9zdHJlYW1zL2NvbnZlcnNpb24udHNcIjtcblxuY29uc3QgY2xpZW50cyA9IG5ldyBNYXA8bnVtYmVyLCBXZWJTb2NrZXQ+KCk7XG5sZXQgY2xpZW50SWQgPSAwO1xuZnVuY3Rpb24gZGlzcGF0Y2gobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgZm9yIChjb25zdCBjbGllbnQgb2YgY2xpZW50cy52YWx1ZXMoKSkge1xuICAgIGNsaWVudC5zZW5kKG1zZyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gd3NIYW5kbGVyKHdzOiBXZWJTb2NrZXQpIHtcbiAgY29uc3QgaWQgPSArK2NsaWVudElkO1xuICBjbGllbnRzLnNldChpZCwgd3MpO1xuICB3cy5vbm9wZW4gPSAoKSA9PiB7XG4gICAgZGlzcGF0Y2goYENvbm5lY3RlZDogWyR7aWR9XWApO1xuICB9O1xuICB3cy5vbm1lc3NhZ2UgPSAoZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKGBtc2c6JHtpZH1gLCBlLmRhdGEpO1xuICAgIGRpc3BhdGNoKGBbJHtpZH1dOiAke2UuZGF0YX1gKTtcbiAgfTtcbiAgd3Mub25jbG9zZSA9ICgpID0+IHtcbiAgICBjbGllbnRzLmRlbGV0ZShpZCk7XG4gICAgZGlzcGF0Y2goYENsb3NlZDogWyR7aWR9XWApO1xuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiByZXF1ZXN0SGFuZGxlcihyZXE6IERlbm8uUmVxdWVzdEV2ZW50KSB7XG4gIGNvbnN0IHBhdGhuYW1lID0gbmV3IFVSTChyZXEucmVxdWVzdC51cmwpLnBhdGhuYW1lO1xuICBpZiAocmVxLnJlcXVlc3QubWV0aG9kID09PSBcIkdFVFwiICYmIHBhdGhuYW1lID09PSBcIi9cIikge1xuICAgIC8vU2VydmUgd2l0aCBoYWNrXG4gICAgY29uc3QgdSA9IG5ldyBVUkwoXCIuL2luZGV4Lmh0bWxcIiwgaW1wb3J0Lm1ldGEudXJsKTtcbiAgICBpZiAodS5wcm90b2NvbC5zdGFydHNXaXRoKFwiaHR0cFwiKSkge1xuICAgICAgLy8gc2VydmVyIGxhdW5jaGVkIGJ5IGRlbm8gcnVuIGh0dHAocyk6Ly8uLi4vc2VydmVyLnRzLFxuICAgICAgZmV0Y2godS5ocmVmKS50aGVuKGFzeW5jIChyZXNwKSA9PiB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBuZXcgVWludDhBcnJheShhd2FpdCByZXNwLmFycmF5QnVmZmVyKCkpO1xuICAgICAgICByZXEucmVzcG9uZFdpdGgoXG4gICAgICAgICAgbmV3IFJlc3BvbnNlKGJvZHksIHtcbiAgICAgICAgICAgIHN0YXR1czogcmVzcC5zdGF0dXMsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIFwiY29udGVudC10eXBlXCI6IFwidGV4dC9odG1sXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHNlcnZlciBsYXVuY2hlZCBieSBkZW5vIHJ1biAuL3NlcnZlci50c1xuICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IERlbm8ub3Blbihmcm9tRmlsZVVybCh1KSk7XG4gICAgICByZXEucmVzcG9uZFdpdGgoXG4gICAgICAgIG5ldyBSZXNwb25zZShyZWFkYWJsZVN0cmVhbUZyb21SZWFkZXIoZmlsZSksIHtcbiAgICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBcImNvbnRlbnQtdHlwZVwiOiBcInRleHQvaHRtbFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoXG4gICAgcmVxLnJlcXVlc3QubWV0aG9kID09PSBcIkdFVFwiICYmIHBhdGhuYW1lID09PSBcIi9mYXZpY29uLmljb1wiXG4gICkge1xuICAgIHJlcS5yZXNwb25kV2l0aChSZXNwb25zZS5yZWRpcmVjdChcImh0dHBzOi8vZGVuby5sYW5kL2Zhdmljb24uaWNvXCIsIDMwMikpO1xuICB9IGVsc2UgaWYgKHJlcS5yZXF1ZXN0Lm1ldGhvZCA9PT0gXCJHRVRcIiAmJiBwYXRobmFtZSA9PT0gXCIvd3NcIikge1xuICAgIGNvbnN0IHsgc29ja2V0LCByZXNwb25zZSB9ID0gRGVuby51cGdyYWRlV2ViU29ja2V0KHJlcS5yZXF1ZXN0KTtcbiAgICB3c0hhbmRsZXIoc29ja2V0KTtcbiAgICByZXEucmVzcG9uZFdpdGgocmVzcG9uc2UpO1xuICB9XG59XG5cbmNvbnN0IHNlcnZlciA9IERlbm8ubGlzdGVuKHsgcG9ydDogODA4MCB9KTtcbmNvbnNvbGUubG9nKFwiY2hhdCBzZXJ2ZXIgc3RhcnRpbmcgb24gOjgwODAuLi4uXCIpO1xuXG5mb3IgYXdhaXQgKGNvbnN0IGNvbm4gb2Ygc2VydmVyKSB7XG4gIChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgaHR0cENvbm4gPSBEZW5vLnNlcnZlSHR0cChjb25uKTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHJlcXVlc3RFdmVudCBvZiBodHRwQ29ubikge1xuICAgICAgcmVxdWVzdEhhbmRsZXIocmVxdWVzdEV2ZW50KTtcbiAgICB9XG4gIH0pKCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBS08sTUFBTSxTQUFpQixBQUFDLENBQUEsSUFBTTtJQUVuQyxNQUFNLEVBQUUsTUFBQSxNQUFJLEVBQUUsR0FBRztJQUNqQixJ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
