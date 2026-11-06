import {
  ensureSandbox,
  writeSandboxFiles as writeSandboxFilesLib,
  readSandboxFiles as readSandboxFilesLib,
  readSandboxTree as readSandboxTreeLib,
  runSandboxCommand as runSandboxCommandLib,
  type FileCollection,
  type FileEntry,
} from "../../lib/sandbox";

export async function createSandbox(projectId: string): Promise<string> {
  const sandboxDir = await ensureSandbox(projectId);
  return sandboxDir;
}

export async function writeSandboxFiles(
  projectId: string,
  files: FileCollection,
): Promise<string> {
  return await writeSandboxFilesLib(projectId, files);
}

export async function readSandboxFiles(
  projectId: string,
  filePaths: string[],
): Promise<FileEntry[]> {
  return await readSandboxFilesLib(projectId, filePaths);
}

export async function readSandboxTree(
  projectId: string,
): Promise<FileCollection> {
  return await readSandboxTreeLib(projectId);
}

export async function runSandboxCommand(
  projectId: string,
  command: string,
): Promise<string> {
  return await runSandboxCommandLib(projectId, command);
}

export type { FileCollection, FileEntry };

