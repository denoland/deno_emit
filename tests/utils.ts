import {
  fromFileUrl,
  join,
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
import {
  assert,
  assertArrayIncludes,
  assertEquals,
  AssertionError,
} from "https://deno.land/std@0.182.0/testing/asserts.ts";
import {
  buildMessage,
  diffstr,
} from "https://deno.land/std@0.182.0/testing/_diff.ts";
import {
  bundle,
  type BundleOptions,
  transpile,
  type TranspileOptions,
} from "../js/mod.ts";
import * as base64Url from "https://deno.land/std@0.182.0/encoding/base64url.ts";
import * as base64 from "https://deno.land/std@0.182.0/encoding/base64.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const inlineSourceMapRegex =
  /^\/\/# sourceMappingURL=data:application\/json;base64,([a-zA-Z0-9+/=]+)$/;

// Tracks which snapshots are involved in order to identify conflicts.
const tracker: Set<string> = new Set();

type CollapsedUnion<A, B> = { [key in keyof (A | B)]: A[key] & B[key] };
type CommonOptions = CollapsedUnion<TranspileOptions, BundleOptions>;

type TranspileResult = Awaited<ReturnType<typeof transpile>>;
interface TestTranspileOutput {
  result: TranspileResult;
  rootUrl: string;
  transpiledRootPath: string;
  modulesPaths: Record<string, string>;
  denoConfigPath: string;
}

type BundleResult = Awaited<ReturnType<typeof bundle>>;
interface TestBundleOutput {
  result: BundleResult;
  bundlePath: string;
  sourceMapPath?: string;
}

interface CommonOutput {
  outputPath: string;
  outputCode: string;
  denoConfigPath?: string;
  functionCalled: "transpile" | "bundle";
}

/**
 * Calls `transpile` with the provided parameters and checks that the output is
 * consistent with the snapshots.
 * Each module in the record returned by `transpile` is stored as its own file.
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
  options?: TranspileOptions,
  more?: (
    output: TestTranspileOutput,
    t: Deno.TestContext,
  ) => void | Promise<void>,
) {
  return async function (t: Deno.TestContext): Promise<void> {
    const result = fixTranspileResult(await transpile(root, options));

    const normalizedRoot = normalizeIfFileUrl(
      (root instanceof URL ? root : toFileUrl(resolve(root))).toString(),
    );

    assertArrayIncludes(Object.keys(result), [normalizedRoot]);

    const testDir = resolve(getSnapshotDir(t), ...getTestPath(t));

    // We want to write the modules to disk, so we'll need to assign them a
    // file path consistent between runs.
    const modules: { filePath: string; url: URL; source: string }[] = [];

    // For remote URLs, the origin is likely to contain special characters that
    // are annoying to handle in the file system, so we hash it.
    const originToHash: Map<string, string> = new Map();

    for (const [urlStr, source] of Object.entries(result)) {
      const url = new URL(urlStr);

      let filePath: string;
      if (url.protocol === "file:") {
        filePath = `local${url.pathname}`;
      } else {
        let hash = originToHash.get(url.origin);
        if (hash === undefined) {
          hash = await hashShortSha1(url.origin);
          originToHash.set(url.origin, hash);
        }
        filePath = `remote/${hash}${url.pathname}`;
      }
      modules.push({ filePath, url, source });
    }

    // We need to record the result in a serializable format that references
    // the modules by their location on disk.
    const modulesRecord: Record<string, string> = Object.fromEntries(
      modules.map(({ filePath, url }) => {
        return [url, filePath];
      }),
    );

    // We also generate a config file with an import map so that the modules
    // are runnable.
    const denoConfig = {
      imports: Object.fromEntries(
        Array.from(originToHash).map(([origin, hash]) => {
          return [origin, `./remote/${hash}`];
        }),
      ),
    };

    const snapshotEntries: [string, string][] = modules.map((
      { filePath, source },
    ): [string, string] => {
      // The file path is a POSIX path, for stability, but we need an
      // OS-specific one so we can read and write the actual file.
      const osFilePath = join(...filePath.split("/"));
      return [osFilePath, source];
    }).concat(
      [
        [
          "modules.json",
          JSON.stringify(modulesRecord, null, 2) + "\n",
        ],
        [
          "deno.json",
          JSON.stringify(denoConfig, null, 2) + "\n",
        ],
      ],
    );

    const snapshotMode =
      existsSync(testDir, { isReadable: true, isDirectory: true })
        ? getMode()
        : "update";

    await assertSnapshots(
      resolve(testDir),
      snapshotEntries,
      snapshotMode,
    );

    if (more) {
      const modulesPaths = Object.fromEntries(
        Object.entries(modulesRecord).map(([url, posixRelativePath]) => {
          return [url, resolve(testDir, ...posixRelativePath.split("/"))];
        }),
      );
      const denoConfigPath = resolve(testDir, "deno.json");
      const output: TestTranspileOutput = {
        result,
        rootUrl: normalizedRoot,
        transpiledRootPath: modulesPaths[normalizedRoot],
        modulesPaths,
        denoConfigPath,
      };
      await more(output, t);
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
  more?: (
    output: TestBundleOutput,
    t: Deno.TestContext,
  ) => void | Promise<void>,
) {
  return async function (t: Deno.TestContext): Promise<void> {
    const result = fixBundleResult(await bundle(root, options));

    const testPath = getTestPath(t);
    const testName = testPath.pop();
    const snapshotDir = getSnapshotDir(t);

    const bundlePath = resolve(snapshotDir, ...testPath, `${testName}.js`);
    const sourceMapPath = resolve(
      snapshotDir,
      ...testPath,
      `${testName}.js.map`,
    );

    const snapshotMode =
      existsSync(snapshotDir, { isReadable: true, isDirectory: true })
        ? getMode()
        : "update";
    await assertSnapshot(
      bundlePath,
      result.code,
      snapshotMode,
    );
    await assertSnapshot(
      sourceMapPath,
      result.map,
      snapshotMode,
    );

    if (more) {
      const output: TestBundleOutput = {
        result,
        bundlePath,
        sourceMapPath: result.map ? sourceMapPath : undefined,
      };
      await more(output, t);
    }
  };
}

export function testTranspileAndBundle(
  root: string | URL,
  options?: CommonOptions,
  more?: (
    output: CommonOutput,
    t: Deno.TestContext,
  ) => void | Promise<void>,
) {
  return async function (t: Deno.TestContext): Promise<void> {
    await t.step({
      name: "bundle",
      fn: testBundle(
        root,
        options,
        more
          ? (output, t) => {
            return more({
              outputPath: output.bundlePath,
              outputCode: output.result.code,
              functionCalled: "bundle",
            }, t);
          }
          : undefined,
      ),
    });
    await t.step({
      name: "transpile",
      fn: testTranspile(
        root,
        options,
        more
          ? (output, t) => {
            return more({
              outputPath: output.transpiledRootPath,
              outputCode: output.result[output.rootUrl],
              denoConfigPath: output.denoConfigPath,
              functionCalled: "transpile",
            }, t);
          }
          : undefined,
      ),
    });
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
function getTestPath(
  context: Deno.TestContext,
): string[] {
  // Avoiding special characters other than dash and underscore
  const name = slugify(context.name);
  if (!context.parent) {
    return [name];
  }
  return [...getTestPath(context.parent), name];
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
    const normalizedPath = SEP + relative(join(Deno.cwd(), "testdata"), path);
    return toFileUrl(normalizedPath).toString();
  }
  return url.toString();
}

// We need to normalize the file URLs because they contain absolute paths, which
// are device-dependent.

/**
 * Transpile results are not stable between runs because:
 * - The record is indexed by the URLs of the modules; but those contain
 * absolute file paths, which are device-dependent.
 * - The code can contain inline source maps, which also contain absolute
 * file paths.
 * - The ordering of keys is not guaranteed.
 *
 * This function fixes those issues.
 */
function fixTranspileResult(result: TranspileResult): TranspileResult {
  return Object.fromEntries(
    Object.entries(result).map((
      [url, source],
    ): [string, string] => {
      url = normalizeIfFileUrl(url);
      source = fixInlineSourceMap(source);
      return [url, source];
    }).sort((a, b) => {
      if (a[0] > b[0]) return 1;
      if (a[0] < b[0]) return -1;
      return 0;
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

/**
 * Creates a temporary file with the provided code and runs it with `deno run`.
 * @param code
 * @returns output of `deno run`
 */
export async function runCode(
  code: string,
  configPath?: string,
): Promise<string> {
  const tempFile = await makeTempFile(code);
  return runModule(tempFile, configPath);
}

/**
 * Runs the script at the provided path with `deno run`. Success is expected.
 * @param modulePath
 * @returns output of `deno run`
 */
export async function runModule(
  modulePath: string,
  configPath?: string,
): Promise<string> {
  const { success, output, stderrOutput } = await denoRun(
    modulePath,
    configPath,
  );
  assertEquals(stderrOutput, "", "deno run does not output to stderr");
  assert(success, "deno run succeeds");
  return output;
}

async function makeTempFile(content?: string): Promise<string> {
  const tempFilePath = await Deno.makeTempFile({
    prefix: "deno_emit_bundle_test",
  });
  if (typeof content === "string") {
    await Deno.writeTextFile(tempFilePath, content);
  }
  return tempFilePath;
}

async function denoRun(
  modulePath: string,
  configPath?: string,
): Promise<
  { success: boolean; code: number; output: string; stderrOutput: string }
> {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", modulePath].concat(
      configPath ? ["--config", configPath] : [],
    ),
    cwd: Deno.cwd(),
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const process = command.spawn();
  const { success, code, stdout, stderr } = await process.output();
  const output = textDecoder.decode(stdout);
  const stderrOutput = textDecoder.decode(stderr);
  return { success, code, output, stderrOutput };
}
