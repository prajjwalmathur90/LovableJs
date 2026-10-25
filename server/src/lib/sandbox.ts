import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { sandboxRoot } from "../config/constants";

export type FileCollection = Record<string, string>;

function getValidatedSandboxPath(sandboxId: string): string {
  if (!sandboxId || typeof sandboxId !== "string" || !sandboxId.trim()) {
    throw new Error("Invalid sandbox ID: sandboxId must be a non-empty string");
  }

  const resolvedRoot = path.resolve(sandboxRoot);
  const sandboxPath = path.resolve(resolvedRoot, sandboxId);

  const relative = path.relative(resolvedRoot, sandboxPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid sandbox ID: Path must be inside sandbox root");
  }

  return sandboxPath;
}

export async function ensureSandbox(sandboxId: string): Promise<string> {
  const sandboxPath = getValidatedSandboxPath(sandboxId);

  if (!existsSync(sandboxPath)) {
    await fs.mkdir(sandboxPath, { recursive: true });
  }

  return sandboxPath;
}

export function ensureSandboxSync(sandboxId: string): string {
  const sandboxPath = getValidatedSandboxPath(sandboxId);

  if (!existsSync(sandboxPath)) {
    mkdirSync(sandboxPath, { recursive: true });
  }

  return sandboxPath;
}

function sanitizeRelativeFilePath(rawPath: string): string {
  const withoutDrive = rawPath.replace(/^[a-zA-Z]:[/\\]*/, "");
  const withoutLeadingSlashes = withoutDrive.replace(/^[/\\]+/, "");
  const segments = withoutLeadingSlashes
    .split(/[/\\]+/)
    .filter((seg) => seg !== "" && seg !== "." && seg !== "..");

  return segments.join(path.sep);
}

export async function writeSandboxFiles(
  sandboxId: string,
  fileCollection: FileCollection,
): Promise<string> {
  const sandboxDir = await ensureSandbox(sandboxId);

  for (const [rawPath, content] of Object.entries(fileCollection)) {
    const cleanPath = sanitizeRelativeFilePath(rawPath);
    if (!cleanPath) {
      continue;
    }

    const filePath = path.resolve(sandboxDir, cleanPath);
    const relative = path.relative(sandboxDir, filePath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(
        `Unsafe file path: "${rawPath}" resolves outside of sandbox`,
      );
    }

    const parentDir = path.dirname(filePath);
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
  }

  return sandboxDir;
}
