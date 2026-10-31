import fs from "fs/promises";
import path from "path";

import { sandboxRoot } from "../config/constants";

/*
|--------------------------------------------------------------------------
| TYPE DEFINITIONS
|--------------------------------------------------------------------------
*/

/**
 * Represents a collection of files.
 *
 * Key   -> Relative file path inside a sandbox.
 * Value -> Content of that file.
 *
 * Example:
 *
 * {
 *   "package.json": "{\"name\":\"demo\"}",
 *   "src/index.ts": "console.log('Hello World');",
 *   "README.md": "# My Project"
 * }
 *
 * This is an in-memory JavaScript object, not a directory itself.
 */
export type FileCollection = Record<string, string>;

/**
 * Represents a single file returned by readSandboxFiles().
 *
 * Example:
 *
 * {
 *   path: "src/index.ts",
 *   content: "console.log('Hello World');"
 * }
 */
export type FileEntry = {
  path: string;
  content: string;
};

/*
|--------------------------------------------------------------------------
| 1. GENERIC PATH VALIDATION
|--------------------------------------------------------------------------
*/

/**
 * Checks whether targetPath is strictly inside root.
 *
 * PURPOSE:
 * Prevent a filesystem operation from using a path that escapes
 * its intended parent directory.
 *
 * EXAMPLE:
 *
 * root:
 *   /app/sandboxes/demo
 *
 * targetPath:
 *   /app/sandboxes/demo/src/index.ts
 *
 * This target is inside root, so the check passes.
 *
 * But:
 *
 * targetPath:
 *   /app/private-data.txt
 *
 * This target is outside root, so the function throws an error.
 *
 * NOTE:
 * The current implementation rejects the root itself, too.
 */
function assertPathInsideRoot(
  root: string,
  targetPath: string,
  errorMessage = "Invalid path",
): void {
  // Convert both paths to absolute, normalized filesystem paths.
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);

  // Calculate how to get from root to targetPath.
  //
  // Example:
  // root   = /app/sandboxes/demo
  // target = /app/sandboxes/demo/src/index.ts
  // result = src/index.ts
  //
  // If target is outside root, the relative path may begin with "../".
  const relative = path.relative(resolvedRoot, resolvedTarget);

  // Reject the path if:
  //
  // 1. relative is empty: targetPath equals root.
  // 2. relative starts with "..": the path may escape the root.
  // 3. relative is absolute: the paths could not be compared safely
  //    as an ordinary relative path.
  //
  // Important: startsWith("..") is overly broad. For example, a
  // legitimate child named "..notes" would also be rejected.
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(errorMessage);
  }
}

/**
 * Sandbox-specific wrapper around assertPathInsideRoot().
 *
 * Instead of repeatedly supplying sandboxRoot and an error message,
 * other functions can call this helper with just the sandbox path.
 *
 * Example:
 *
 * assertSandboxPathInsideRoot("/app/sandboxes/demo");
 */
function assertSandboxPathInsideRoot(sandboxPath: string): void {
  assertPathInsideRoot(sandboxRoot, sandboxPath, "Invalid sandbox ID");
}

/*
|--------------------------------------------------------------------------
| 2. RELATIVE FILE PATH SANITIZATION
|--------------------------------------------------------------------------
*/

/**
 * Cleans a file path supplied by a caller.
 *
 * PURPOSE:
 * Normalize path separators and remove "." and ".." segments
 * before the path is resolved against a sandbox directory.
 *
 * EXAMPLE:
 *
 * Input:
 *   src\components\Button.tsx
 *
 * The separators are normalized and the resulting relative path
 * is equivalent to:
 *   src/components/Button.tsx
 *
 * Another example:
 *
 * Input:
 *   ../../etc/passwd
 *
 * Output:
 *   etc/passwd
 *
 * Notice that this function removes traversal segments instead of
 * rejecting the entire input.
 *
 * IMPORTANT:
 * Sanitization alone is not a complete filesystem security boundary.
 * Callers must also validate the resolved destination.
 */
function sanitizeSandboxRelativePath(relativePath: string): string {
  // Reject values that are not strings.
  // Runtime checks are useful even when TypeScript declares a string
  // because external input can be malformed.
  if (typeof relativePath !== "string") {
    throw new Error("Invalid file path");
  }

  // Remove an initial Windows drive prefix, such as "C:\" or "D:".
  //
  // Example:
  // C:\Users\student\index.ts
  // becomes approximately:
  // Users\student\index.ts
  const withoutDrive = relativePath.replace(/^[a-zA-Z]:[/\\]*/, "");

  // Remove leading forward or backward slashes.
  //
  // Example:
  // /src/index.ts -> src/index.ts
  const withoutLeadingSlashes = withoutDrive.replace(/^[/\\]+/, "");

  // Normalize the path and split it into individual segments.
  const segments = withoutLeadingSlashes
    // Convert Windows backslashes to forward slashes.
    .replace(/\\/g, "/")

    // Split the path into individual segments.
    // "src/index.ts" -> ["src", "index.ts"]
    .split("/")

    // Remove empty segments produced by repeated separators.
    .filter((segment) => segment.length > 0);

  // Store the accepted path segments here.
  const safeSegments: string[] = [];

  // Examine every segment independently.
  for (const segment of segments) {
    // Skip the current-directory and parent-directory segments.
    if (segment === "." || segment === "..") {
      continue;
    }

    // Keep ordinary directory and file names.
    safeSegments.push(segment);
  }

  // Join the segments using the separator for the current OS.
  //
  // On Linux/macOS: /
  // On Windows:     \
  const cleaned = safeSegments.join(path.sep);

  // If every segment was removed, there is no usable path.
  if (!cleaned) {
    throw new Error("Invalid file path");
  }

  // Return the cleaned relative path.
  return cleaned;
}

/*
|--------------------------------------------------------------------------
| 3. VALIDATE A SANDBOX ID
|--------------------------------------------------------------------------
*/

/**
 * Validates a sandbox ID and returns its absolute directory path.
 *
 * PURPOSE:
 * Make sure the supplied ID is acceptable before using it to
 * construct a filesystem path.
 *
 * EXAMPLE:
 *
 * If:
 *   sandboxRoot = "/app/sandboxes"
 *   sandboxId   = "demo"
 *
 * Returns:
 *   "/app/sandboxes/demo"
 *
 * IMPORTANT:
 * This function calculates and validates a path.
 * It does NOT create a directory.
 */
export function validateSandboxId(sandboxId: string): string {
  // Reject empty, malformed, or absolute IDs.
  if (
    !sandboxId ||
    typeof sandboxId !== "string" ||
    !sandboxId.trim() ||
    sandboxId === "." ||
    sandboxId.includes("..") ||
    path.isAbsolute(sandboxId)
  ) {
    throw new Error("Invalid sandbox ID");
  }

  // Construct the absolute sandbox directory path.
  const sandboxPath = path.resolve(sandboxRoot, sandboxId);

  // Verify that the calculated path is beneath sandboxRoot.
  assertSandboxPathInsideRoot(sandboxPath);

  // Return the path without creating anything on disk.
  return sandboxPath;
}

/*
|--------------------------------------------------------------------------
| 4. ENSURE THAT A SANDBOX DIRECTORY EXISTS
|--------------------------------------------------------------------------
*/

/**
 * Validates a sandbox ID and ensures that its directory exists.
 *
 * PURPOSE:
 * Create a sandbox directory if it doesn't already exist.
 *
 * EXAMPLE:
 *
 * const directory = await ensureSandbox("demo");
 *
 * The returned value might be:
 *   "/app/sandboxes/demo"
 *
 * If the directory doesn't exist, it is created.
 * If it already exists, mkdir() succeeds without creating a duplicate.
 */
export async function ensureSandbox(sandboxId: string): Promise<string> {
  // Validate the ID and calculate the absolute path.
  const sandboxPath = validateSandboxId(sandboxId);

  // Create the directory if needed.
  //
  // recursive: true also creates any missing parent directories
  // and allows the target directory to already exist.
  await fs.mkdir(sandboxPath, { recursive: true });

  // Return the absolute path to the sandbox directory.
  return sandboxPath;
}

/*
|--------------------------------------------------------------------------
| 5. WRITE MULTIPLE FILES INTO A SANDBOX
|--------------------------------------------------------------------------
*/

/**
 * Writes files from a FileCollection into a sandbox.
 *
 * PURPOSE:
 * Convert an in-memory collection of relative paths and file
 * contents into actual files and directories on disk.
 *
 * EXAMPLE:
 *
 * await writeSandboxFiles("demo", {
 *   "README.md": "# Demo Project",
 *   "src/index.ts": "console.log('Hello World');"
 * });
 *
 * This writes README.md and src/index.ts inside the demo sandbox.
 *
 * Existing files with the same paths are normally overwritten.
 *
 * RETURNS:
 * The absolute path to the sandbox directory.
 */
export async function writeSandboxFiles(
  sandboxId: string,
  fileCollection: FileCollection,
): Promise<string> {
  // Validate the sandbox ID and ensure that its directory exists.
  const sandboxDir = await ensureSandbox(sandboxId);

  // If there is no usable collection, return the sandbox path.
  //
  // An empty object also results in no files being written.
  if (!fileCollection || typeof fileCollection !== "object") {
    return sandboxDir;
  }

  // Convert the collection into file-writing tasks.
  //
  // Example:
  //
  // {
  //   "README.md": "# Demo",
  //   "src/index.ts": "console.log('Hello');"
  // }
  //
  // Object.entries() produces:
  //
  // [
  //   ["README.md", "# Demo"],
  //   ["src/index.ts", "console.log('Hello');"]
  // ]
  //
  // Promise.all() waits for all tasks to finish.
  // Multiple files can be processed concurrently.
  await Promise.all(
    Object.entries(fileCollection).map(async ([relativePath, content]) => {
      // Clean the caller-supplied relative file path.
      const cleanedPath = sanitizeSandboxRelativePath(relativePath);

      // Construct the absolute path of the target file.
      //
      // Example:
      // sandboxDir = /app/sandboxes/demo
      // cleanedPath = src/index.ts
      //
      // filePath = /app/sandboxes/demo/src/index.ts
      const filePath = path.resolve(sandboxDir, cleanedPath);

      // Verify that the resulting path is strictly inside the sandbox.
      //
      // If the validation fails, throw an error instead of
      // proceeding with this write operation.
      assertPathInsideRoot(
        sandboxDir,
        filePath,
        `Unsafe file path: ${relativePath}`,
      );

      // Create the parent directory of the file, including any
      // missing nested directories.
      //
      // For src/components/Button.tsx, this creates:
      // src/components/
      await fs.mkdir(path.dirname(filePath), {
        recursive: true,
      });

      // Write the provided string to the file using UTF-8 encoding.
      //
      // If the file already exists, its contents are normally replaced.
      await fs.writeFile(filePath, content, "utf8");
    }),
  );

  // Return the absolute path to the sandbox.
  // The contents of the files are not returned.
  return sandboxDir;
}

/*
|--------------------------------------------------------------------------
| 6. READ SPECIFIC FILES FROM A SANDBOX
|--------------------------------------------------------------------------
*/

/**
 * Reads only the files requested by the caller.
 *
 * PURPOSE:
 * Retrieve the contents of selected files without scanning
 * the entire project.
 *
 * EXAMPLE:
 *
 * const result = await readSandboxFiles("demo", [
 *   "README.md",
 *   "src/index.ts"
 * ]);
 *
 * Example result:
 *
 * [
 *   { path: "README.md", content: "# Demo Project" },
 *   { path: "src/index.ts", content: "console.log('Hello World');" }
 * ]
 *
 * If a requested file cannot be read, the error propagates to the caller.
 */
export async function readSandboxFiles(
  sandboxId: string,
  filePaths: string[],
): Promise<FileEntry[]> {
  // Validate the sandbox ID and calculate its absolute path.
  // Unlike ensureSandbox(), this does not create the directory.
  const sandboxDir = validateSandboxId(sandboxId);

  // Collect the file paths and their contents here.
  const results: FileEntry[] = [];

  // Process the requested paths one at a time.
  for (const rawPath of filePaths) {
    // Normalize the caller-supplied relative file path.
    const cleanedPath = sanitizeSandboxRelativePath(rawPath);

    // Resolve the requested file against the sandbox directory.
    const filePath = path.resolve(sandboxDir, cleanedPath);

    // Make sure the target remains inside the sandbox.
    assertPathInsideRoot(sandboxDir, filePath, `Unsafe file path: ${rawPath}`);

    // Read the file as UTF-8 text.
    //
    // If the file doesn't exist or cannot be read, this operation
    // throws. This function does not catch that error.
    const content = await fs.readFile(filePath, "utf8");

    // Store the result using forward slashes for consistent API output.
    //
    // Example:
    // src\index.ts -> src/index.ts
    results.push({
      path: cleanedPath.replace(/\\/g, "/"),
      content,
    });
  }

  // Return the array of requested files and their contents.
  return results;
}

/*
|--------------------------------------------------------------------------
| 7. DIRECTORY AND FILE FILTERS FOR PROJECT COLLECTION
|--------------------------------------------------------------------------
*/

// Directory names that readSandboxTree() must not explore.
const SKIP_DIRS = new Set([
  "node_modules", // Installed dependencies
  "dist", // Common build output
  "build", // Common build output
  "out", // Common generated output
  "target", // Common build output
  "tmp", // Temporary data
  "temp", // Temporary data
  "cache", // Cached data
  ".git", // Git repository metadata
]);

// File names that readSandboxTree() must not collect.
const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  "Thumbs.db",
]);

// Maximum size allowed for an individual file.
// 1024 * 1024 * 10 = 10,485,760 bytes = 10 MiB.
const MAX_TRACKED_BYTE_SIZE = 1024 * 1024 * 10;

/*
|--------------------------------------------------------------------------
| 8. READ THE ENTIRE SANDBOX TREE
|--------------------------------------------------------------------------
*/

/**
 * Recursively explores a sandbox and collects eligible files.
 *
 * PURPOSE:
 * Discover files automatically when the caller does not already
 * know their paths.
 *
 * Unlike readSandboxFiles(), this function scans directories.
 *
 * EXAMPLE:
 *
 * const allFiles = await readSandboxTree("demo");
 *
 * Possible result:
 *
 * {
 *   "package.json": "{\"name\":\"demo\"}",
 *   "README.md": "# Demo Project",
 *   "src/index.ts": "console.log('Hello World');"
 * }
 *
 * The function skips configured directories, configured filenames,
 * symbolic links, files larger than 10 MiB, and entries that cause
 * certain filesystem operations to fail.
 */
export async function readSandboxTree(
  sandboxId: string,
): Promise<FileCollection> {
  // Validate the sandbox ID and get the absolute root directory.
  const root = validateSandboxId(sandboxId);

  // Store collected files using relative paths as keys.
  const files: FileCollection = {};

  /**
   * Recursively explores one directory.
   *
   * "current" is the absolute path of the directory being examined.
   *
   * For example:
   *   First call:  /app/sandboxes/demo
   *   Later call:  /app/sandboxes/demo/src
   *
   * The function calls itself for directories that are not excluded.
   */
  const walk = async (current: string) => {
    // Initially, no directory entries have been collected.
    let entries = [];

    try {
      // List the current directory.
      //
      // withFileTypes: true gives us Dirent objects, allowing us
      // to check whether an entry is a file, directory, or symlink.
      entries = await fs.readdir(current, {
        withFileTypes: true,
      });
    } catch {
      // If the directory cannot be read, skip this directory.
      //
      // This is a best-effort strategy, but it silently hides errors.
      return;
    }

    // Examine every entry in the current directory.
    for (const entry of entries) {
      // Skip symbolic links rather than following them during traversal.
      if (entry.isSymbolicLink()) continue;

      // Construct the absolute path to the current entry.
      const fullPath = path.join(current, entry.name);

      // If this entry is a directory, decide whether to explore it.
      if (entry.isDirectory()) {
        // Explore the directory only if its name is not excluded.
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(fullPath);
        }

        // Directories are not collected as files.
        // Continue to the next entry.
        continue;
      }

      // Skip entries that are not ordinary files, and files whose
      // names appear in SKIP_FILES.
      if (!entry.isFile() || SKIP_FILES.has(entry.name)) {
        continue;
      }

      try {
        // Get metadata for the file, including its size in bytes.
        const stat = await fs.stat(fullPath);

        // Skip files larger than the configured individual size limit.
        if (stat.size > MAX_TRACKED_BYTE_SIZE) continue;

        // Convert the absolute file path into a path relative to root.
        //
        // Example:
        // root     = /app/sandboxes/demo
        // fullPath = /app/sandboxes/demo/src/index.ts
        //
        // relativePosix = src/index.ts
        //
        // Forward slashes provide consistent keys across platforms.
        const relativePosix = path.relative(root, fullPath).replace(/\\/g, "/");

        // Read the file as UTF-8 text and save its contents.
        //
        // Example:
        // files["src/index.ts"] = "console.log('Hello World');"
        files[relativePosix] = await fs.readFile(fullPath, "utf8");
      } catch {
        // Skip files that cannot be inspected or read.
        //
        // Like the directory-level catch above, this intentionally
        // ignores errors rather than reporting them to the caller.
      }
    }
  };

  // Start exploring from the sandbox's root directory.
  // This waits until the recursive traversal has completed.
  await walk(root);

  // Return the collected files as a FileCollection.
  return files;
}
