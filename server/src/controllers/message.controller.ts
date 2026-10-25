import { Request, Response } from "express";
import { getMessagesByProjectIdService } from "../services/message.service";
import { sendSuccess } from "../utils/api-response";

export async function getMessagesByProjectIdController(
  req: Request,
  res: Response
) {
  const { projectId } = req.params as { projectId: string };
  const messages = await getMessagesByProjectIdService(projectId);
  return sendSuccess(res, messages);
}

