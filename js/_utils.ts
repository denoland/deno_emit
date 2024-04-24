import { isAbsolute, resolve, toFileUrl } from "@std/path";

/**
 * Resolves a location to its canonical URL object.
 * @description
 * The JS API is pretty liberal in what it accepts as a file location.
 * It can be a URL or a path. The URL can be a URL object or a string, and can
 * locate a local file or a remote file. The path can be relative or absolute,
 * and can be represented as a POSIX path or a Win32 path, depending on the
 * system.
 * The Rust API, on the other hand, always expects well-formed URLs, and nothing
 * else.
 * @param location a URL object, a URL string, an absolute file path or a
 *                 relative file path
 * @returns a URL object that matches the location
 */
export function locationToUrl(location: URL | string): URL {
  if (location instanceof URL) {
    // We don't return it directly to ensure that the caller can then safely
    // mutate without affecting the original.
    return new URL(location);
  }
  // We attempt to build a URL from the location; if it succeeds, it's great!
  // If it does not, we assume that it was probably a file path instead.
  try {
    // Absolute file paths on Windows can be successfully parsed as URLs, so we
    // exclude that case first.
    if (!isAbsolute(location)) {
      return new URL(location);
    }
  } catch (error) {
    // Rethrowing errors that have nothing to do with failing to parse the URL.
    if (
      !(error instanceof TypeError &&
        error.message.startsWith("Invalid URL"))
    ) {
      throw error;
    }
  }
  return toFileUrl(resolve(location));
}
