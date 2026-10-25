import { getMessagesByProjectId } from "../repositories/message.repository";

export async function getMessagesByProjectIdService(projectId: string) {
  return await getMessagesByProjectId(projectId);
}
