import fs from "fs/promises";
import path from "path";
import { exec, type ExecException } from "child_process";
import { sandboxRoot } from "../config/constants";
import { promisify } from "util";

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

/*
|--------------------------------------------------------------------------
| 9. EXECUTE SHELL COMMANDS IN A SANDBOX
|--------------------------------------------------------------------------
*/

// Promisified version of Node's child_process.exec() for async/await usage.
const execAsync = promisify(exec);

// Maximum execution time allowed for a command before terminating it.
// 60,000 milliseconds = 1 minute.
const SANDBOX_COMMAND_TIMEOUT_MS = 60_000;

// Maximum amount of output data (in bytes) allowed on stdout or stderr.
// 1024 * 1024 = 1,048,576 bytes = 1 MiB.
const SANDBOX_COMMAND_MAX_BUFFER = 1024 * 1024; // 1MB

/**
 * Formats standard output and standard error from a successful execution.
 *
 * PURPOSE:
 * Provide a clean, human-readable summary of command output.
 * If stdout has text, it is returned; otherwise stderr is used.
 * If both streams are empty, a default placeholder is returned.
 *
 * EXAMPLE:
 *
 * formatCommandSuccess("Build complete\n", "");
 * // Returns: "Build complete"
 */
function formatCommandSuccess(stdout: string, stderr: string): string {
  // Trim leading and trailing whitespace from both streams.
  const trimmedStdout = stdout.trim();
  const trimmedStderr = stderr.trim();

  // Return standard output if present.
  if (trimmedStdout) return trimmedStdout;

  // Otherwise, return standard error if present.
  if (trimmedStderr) return trimmedStderr;

  // Fallback when the command produced no output.
  return "no output";
}

/**
 * Formats an error message along with captured stdout and stderr streams.
 *
 * PURPOSE:
 * Ensure callers receive complete diagnostics when a command fails,
 * including the core error description and any partial output emitted
 * before termination.
 *
 * EXAMPLE:
 *
 * formatCommandFailure("Command failed", "Building...", "Syntax error");
 * // Returns:
 * // "Error: Command failed\n\nstdout:\nBuilding...\n\nstderr:\nSyntax error"
 */
function formatCommandFailure(
  message: string,
  stdout = "",
  stderr = "",
): string {
  // Start with the main error explanation.
  const parts = [`Error: ${message}`];

  // Trim whitespace from output streams.
  const trimmedStdout = stdout.trim();
  const trimmedStderr = stderr.trim();

  // Append stdout details if present.
  if (trimmedStdout) parts.push(`stdout:\n${trimmedStdout}`);

  // Append stderr details if present.
  if (trimmedStderr) parts.push(`stderr:\n${trimmedStderr}`);

  // Combine error and outputs separated by double newlines.
  return parts.join("\n\n");
}

/**
 * Type guard that safely extracts an ExecException from an unknown error.
 *
 * PURPOSE:
 * Differentiate child_process execution errors (which carry process-specific
 * stdout and stderr streams) from standard JavaScript runtime exceptions.
 */
function asExecException(error: unknown): ExecException | null {
  // Verify that the error is an Error instance.
  if (!(error instanceof Error)) return null;

  // Check whether the error object contains stdout or stderr properties.
  if (!("stdout" in error || "stderr" in error)) return null;

  // Return the error cast to ExecException.
  return error as ExecException;
}

/**
 * Executes a shell command inside the root directory of a sandbox.
 *
 * PURPOSE:
 * Run arbitrary terminal commands (such as dependency installation,
 * build commands, or scripts) within the target sandbox directory,
 * capturing and formatting stdout, stderr, and failure details.
 *
 * EXAMPLE:
 *
 * const output = await runSandboxCommand("demo", "ls -la");
 *
 * Possible success output:
 *   "total 8\ndrwxr-xr-x 2 user group 4096 README.md"
 *
 * Possible failure output:
 *   "Error: Command failed: non-existent-command\n\nstderr:\ncommand not found"
 *
 * RETURNS:
 * A Promise resolving to a formatted string containing either the command's
 * output or diagnostic error details upon failure.
 *
 * NOTE:
 * Unlike readSandboxFiles(), this function calls ensureSandbox(), creating
 * the sandbox directory if it does not already exist.
 * Execution is bounded by timeout (60s) and buffer size limits (1 MiB).
 */
export async function runSandboxCommand(
  sandboxId: string,
  command: string,
): Promise<string> {
  try {
    // Validate the sandbox ID and ensure the directory exists on disk.
    // The command will be executed with this directory as its working directory (cwd).
    const sandboxDir = await ensureSandbox(sandboxId);

    // Run the command asynchronously within the sandbox directory.
    //
    // cwd: sets the current working directory to the sandbox path.
    // timeout: terminates the process if it exceeds SANDBOX_COMMAND_TIMEOUT_MS.
    // maxBuffer: limits maximum stdout/stderr buffer to prevent memory exhaustion.
    const { stdout, stderr } = await execAsync(command, {
      cwd: sandboxDir,
      timeout: SANDBOX_COMMAND_TIMEOUT_MS,
      maxBuffer: SANDBOX_COMMAND_MAX_BUFFER,
    });

    // Format and return successful output.
    return formatCommandSuccess(String(stdout), String(stderr));
  } catch (error) {
    // Attempt to treat the caught exception as an ExecException
    // to access command-specific stdout and stderr streams.
    const execError = asExecException(error);

    // If the failure originated from child_process.exec, include streams in diagnostics.
    if (execError) {
      return formatCommandFailure(
        execError.message,
        String(execError.stdout ?? ""),
        String(execError.stderr ?? ""),
      );
    }

    // Otherwise, format generic or unexpected errors.
    return formatCommandFailure(
      error instanceof Error ? error.message : String(error),
    );
  }
}
