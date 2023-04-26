import {
  fromFileUrl,
  parse,
  relative,
  resolve,
  SEP,
  toFileUrl,
} from "https://deno.land/std@0.182.0/path/mod.ts";
import {
  ensureFile,
  existsSync,
} from "https://deno.land/std@0.182.0/fs/mod.ts";
import { AssertionError } from "https://deno.land/std@0.182.0/testing/asserts.ts";
import {
  buildMessage,
  diffstr,
} from "https://deno.land/std@0.182.0/testing/_diff.ts";
import { bundle, type BundleOptions, emit, type EmitOptions } from "../mod.ts";
import * as base64Url from "https://deno.land/std@0.182.0/encoding/base64url.ts";
import * as base64 from "https://deno.land/std@0.182.0/encoding/base64.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const inlineSourceMapRegex =
  /^\/\/# sourceMappingURL=data:application\/json;base64,([a-zA-Z0-9+/=]+)$/;

// Tracks which snapshots are involved in order to identify conflicts.
const tracker: Set<string> = new Set();

type TranspileResult = Awaited<ReturnType<typeof emit>>;
type BundleResult = Awaited<ReturnType<typeof bundle>>;

/**
 * Calls `emit` with the provided parameters and checks that the output is
 * consistent with the snapshots.
 * Each module in the record returned by `emit` is stored as its own file.
 * In order to avoid special characters, the file name is a hash of the module's
 * URL. The mapping between the hashes and the URLs is stored alongside the
 * modules.
 *
 * @param root The root module specifier to use for the emitted modules.
 * @param options Options to use when emitting.
 * @param more An optional function to perform more assertions.
 * @returns A function to pass to the test runner
 */
export function testTranspile(
  root: string | URL,
  options?: EmitOptions,
  more?: (result: TranspileResult, t: Deno.TestContext) => void | Promise<void>,
) {
  return async function (t: Deno.TestContext): Promise<void> {
    const result = fixTranspileResult(await emit(root, options));

    const testDir = resolve(getSnapshotDir(t), getTestName(t));

    const modules = await Promise.all(
      Object.entries(result).map(async ([url, source]) => {
        const hash = await hashShortSha1(url);
        const fileName = `${hash}.js`;
        return { fileName, url, source };
      }),
    );
    const modulesSnapshotEntries: [string, string][] = modules.map((
      { fileName, source },
    ) => [fileName, source]);
    // The keys need to be sorted in order to have consistency between runs.
    const mapping: Record<string, string> = Object.fromEntries(
      modules.map(({ fileName, url }) => {
        return [url, fileName];
      }).sort((a, b) => {
        if (a[0] > b[0]) return 1;
        if (a[0] < b[0]) return -1;
        return 0;
      }),
    );

    const snapshotMode =
      existsSync(testDir, { isReadable: true, isDirectory: true })
        ? getMode()
        : "update";

    await assertSnapshot(
      resolve(testDir, "mapping.json"),
      JSON.stringify(mapping, null, 2) + "\n",
      snapshotMode,
    );
    await assertSnapshots(
      resolve(testDir, "modules"),
      modulesSnapshotEntries,
      snapshotMode,
    );

    if (more) {
      await more(result, t);
    }
  };
}

/**
 * Calls `bundle` with the provided parameters and checks that the output is
 * consistent with the snapshots of the code, stored as a JavaScript file,
 * and the snapshot of the sourcemap, when it exists.
 *
 * @param root The root module specifier to use for the bundle.
 * @param options Options to use when bundling.
 * @param more An optional function to perform more assertions.
 * @returns A function to pass to the test runner
 */
export function testBundle(
  root: string | URL,
  options?: BundleOptions,
  more?: (result: BundleResult, t: Deno.TestContext) => void | Promise<void>,
) {
  return async function (t: Deno.TestContext): Promise<void> {
    const result = fixBundleResult(await bundle(root, options));

    const testName = getTestName(t);
    const snapshotDir = getSnapshotDir(t);

    const snapshotMode =
      existsSync(snapshotDir, { isReadable: true, isDirectory: true })
        ? getMode()
        : "update";
    await assertSnapshot(
      resolve(snapshotDir, `${testName}.js`),
      result.code,
      snapshotMode,
    );
    await assertSnapshot(
      resolve(snapshotDir, `${testName}.js.map`),
      result.map,
      snapshotMode,
    );

    if (more) {
      await more(result, t);
    }
  };
}

/**
 * Provides the full path of a fixture file stored in "testdata".
 *
 * @param parts Path relative to the folder with the fixtures.
 * @returns the full path of the fixture.
 */
export function resolveFixture(...parts: string[]): string {
  return resolve(Deno.cwd(), "testdata", ...parts);
}

async function assertSnapshot(
  path: string,
  actual: string | undefined,
  mode: SnapshotMode,
): Promise<void> {
  let snapshot: string | undefined;
  try {
    snapshot = await Deno.readTextFile(path);
  } catch (e: unknown) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }

  if (actual === snapshot) {
    return;
  }

  const relativePath = relative(Deno.cwd(), path);

  if (mode === "update") {
    if (tracker.has(path)) {
      throw new Error(`Snapshot already defined at ${relativePath}`);
    }
    await applyUpdate(path, actual);
  } else {
    const diffResult = diffstr(
      actual ?? "",
      snapshot ?? "",
    );
    const diffMsg = buildMessage(diffResult);
    throw new AssertionError(
      `Snapshot at ${relativePath} does not match:\n${diffMsg}`,
    );
  }
}

async function assertSnapshots(
  path: string,
  files: Iterable<[fileName: string, actual: string | undefined]>,
  mode: SnapshotMode,
): Promise<void> {
  const remainingFiles: Set<string> = new Set();
  const dir = Deno.readDir(path);
  try {
    for await (const entry of dir) {
      if (entry.isFile) {
        remainingFiles.add(resolve(path, entry.name));
      }
    }
  } catch (e: unknown) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }
  for (const [fileName, actual] of files) {
    const filePath = resolve(path, fileName);
    await assertSnapshot(filePath, actual, mode);
    remainingFiles.delete(filePath);
  }
  for (const filePath of remainingFiles) {
    await assertSnapshot(filePath, undefined, mode);
  }
}

type SnapshotMode = "assert" | "update";

let _mode: SnapshotMode;

function getMode(): SnapshotMode {
  if (_mode) {
    return _mode;
  } else {
    _mode = Deno.args.some((arg) => arg === "--update" || arg === "-u")
      ? "update"
      : "assert";
    return _mode;
  }
}

// Note that there can be conflicts; different tests can output the same test
// name. It is not ideal but it shouldn't happen in normal circumstances, and
// assertSnapshot will throw if it ever causes snapshots to clash.
function getTestName(
  context: Deno.TestContext,
): string {
  // Avoiding special characters other than dash and underscore
  let name = slugify(context.name);
  if (context.parent) {
    name = `${getTestName(context.parent)}__${name}`;
  }
  return name;
}

function slugify(name: string): string {
  return name
    .replace(/\s/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

function getSnapshotDir(context: Deno.TestContext): string {
  const { dir, name } = parse(fromFileUrl(context.origin));
  const snapshotDir = resolve(
    dir,
    "__snapshots__",
    name.endsWith("_test")
      ? name.substring(0, name.length - "_test".length)
      : name,
  );
  return snapshotDir;
}

async function applyUpdate(
  path: string,
  actual: string | undefined,
): Promise<void> {
  if (actual === undefined) {
    await Deno.remove(path);
    return;
  }
  await ensureFile(path);
  await Deno.writeTextFile(path, actual);
}

// We don't want to litter the snapshots with absolute file paths, which
// depend on where the repository is located on the device.
function normalizeIfFileUrl(urlString: string): string {
  const url = new URL(urlString);
  if (url.protocol === "file:") {
    const path = fromFileUrl(url);
    // We prepend with the separator instead of using `resolve()` because, on
    // Windows, this adds the device prefix (e.g. `C:`), which we don't want.
    const normalizedPath = SEP + relative(Deno.cwd(), path);
    return toFileUrl(normalizedPath).toString();
  }
  return url.toString();
}

// We need to normalize the source map URLs because they are absolute paths.

function fixTranspileResult(result: TranspileResult): TranspileResult {
  return Object.fromEntries(
    Object.entries(result).map((
      [url, source],
    ) => {
      source = fixInlineSourceMap(source);
      url = normalizeIfFileUrl(url);
      return [url, source];
    }),
  );
}

function fixBundleResult(result: BundleResult): BundleResult {
  const code = fixInlineSourceMap(result.code);
  const map = result.map !== undefined ? fixSourceMap(result.map) : undefined;
  return { code, map };
}

function fixSourceMap(sourceMapJsonString: string): string {
  const sourceMap = JSON.parse(sourceMapJsonString);
  sourceMap.sources = sourceMap.sources.map(normalizeIfFileUrl);
  return JSON.stringify(sourceMap);
}

function fixInlineSourceMap(code: string): string {
  const lines = code.split("\n");

  const indexOfLastLine = lines.findLastIndex((line) => line !== "");
  const match = lines[indexOfLastLine]?.match(inlineSourceMapRegex);
  if (match == null) {
    return code;
  }

  const sourceMapBase64 = match[1];
  const sourceMap = textDecoder.decode(base64.decode(sourceMapBase64));
  const newSourceMap = fixSourceMap(sourceMap);
  const newSourceMapBase64 = base64.encode(textEncoder.encode(newSourceMap));

  lines[indexOfLastLine] =
    `//# sourceMappingURL=data:application/json;base64,${newSourceMapBase64}`;

  return lines.join("\n");
}

async function hashShortSha1(input: string): Promise<string> {
  // Base64 makes the hash shorted; the URL variants avoids special characters
  // other than dash and underscore.
  return base64Url.encode(
    await crypto.subtle.digest(
      "SHA-1",
      textEncoder.encode(input),
    ),
  );
}
