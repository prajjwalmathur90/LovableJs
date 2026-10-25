import fs from "fs/promises";
import path from "path";

import { sandboxRoot } from "../config/constants";

export type FileCollection = Record<string, string>; // relative POSIX path -> file content
export type FileEntry = { path: string; content: string };

function assertPathInsideRoot(
  root: string,
  targetPath: string,
  errorMessage = "Invalid path",
): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(errorMessage);
  }
}

function assertSandboxPathInsideRoot(sandboxPath: string): void {
  assertPathInsideRoot(sandboxRoot, sandboxPath, "Invalid sandbox ID");
}

function sanitizeSandboxRelativePath(relativePath: string): string {
  if (typeof relativePath !== "string") {
    throw new Error("Invalid file path");
  }

  const withoutDrive = relativePath.replace(/^[a-zA-Z]:[/\\]*/, "");
  const withoutLeadingSlashes = withoutDrive.replace(/^[/\\]+/, "");
  const segments = withoutLeadingSlashes
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0);

  const safeSegments: string[] = [];
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      continue;
    }
    safeSegments.push(segment);
  }

  const cleaned = safeSegments.join(path.sep);
  if (!cleaned) {
    throw new Error("Invalid file path");
  }

  return cleaned;
}

export function validateSandboxId(sandboxId: string): string {
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

  const sandboxPath = path.resolve(sandboxRoot, sandboxId);
  assertSandboxPathInsideRoot(sandboxPath);
  return sandboxPath;
}

export async function ensureSandbox(sandboxId: string): Promise<string> {
  const sandboxPath = validateSandboxId(sandboxId);
  await fs.mkdir(sandboxPath, { recursive: true });
  return sandboxPath;
}

export async function writeSandboxFiles(
  sandboxId: string,
  fileCollection: FileCollection,
): Promise<string> {
  const sandboxDir = await ensureSandbox(sandboxId);

  if (!fileCollection || typeof fileCollection !== "object") {
    return sandboxDir;
  }

  await Promise.all(
    Object.entries(fileCollection).map(async ([relativePath, content]) => {
      const cleanedPath = sanitizeSandboxRelativePath(relativePath);
      const filePath = path.resolve(sandboxDir, cleanedPath);
      assertPathInsideRoot(
        sandboxDir,
        filePath,
        `Unsafe file path: ${relativePath}`,
      );

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf8");
    }),
  );

  return sandboxDir;
}

export async function readSandboxFiles(
  sandboxId: string,
  filePaths: string[],
): Promise<FileEntry[]> {
  const sandboxDir = validateSandboxId(sandboxId);
  const results: FileEntry[] = [];

  for (const rawPath of filePaths) {
    const cleanedPath = sanitizeSandboxRelativePath(rawPath);
    const filePath = path.resolve(sandboxDir, cleanedPath);
    assertPathInsideRoot(sandboxDir, filePath, `Unsafe file path: ${rawPath}`);

    const content = await fs.readFile(filePath, "utf8");
    // Store with POSIX path separators for consistent API response
    results.push({ path: cleanedPath.replace(/\\/g, "/"), content });
  }

  return results;
}

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "tmp",
  "temp",
  "cache",
  ".git",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  "Thumbs.db",
]);

const MAX_TRACKED_BYTE_SIZE = 1024 * 1024 * 10; // 10MB

export async function readSandboxTree(
  sandboxId: string,
): Promise<FileCollection> {
  const root = validateSandboxId(sandboxId);
  const files: FileCollection = {};

  const walk = async (current: string) => {
    let entries = [];

    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(fullPath);
        continue;
      }
      if (!entry.isFile() || SKIP_FILES.has(entry.name)) continue;

      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > MAX_TRACKED_BYTE_SIZE) continue;

        const relativePosix = path.relative(root, fullPath).replace(/\\/g, "/");

        files[relativePosix] = await fs.readFile(fullPath, "utf8");
      } catch {}
    }
  };

  await walk(root);

  return files;
}
