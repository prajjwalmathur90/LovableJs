import { ensureSandbox } from "../../lib/sandbox";

export async function createSandbox(projectId: string): Promise<string> {
  const sandboxDir = await ensureSandbox(projectId);
  return sandboxDir;
}
