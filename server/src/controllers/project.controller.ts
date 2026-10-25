import { Request, Response } from "express";
import {
  createProjectService,
  getAllProjectsService,
  getProjectByIdService,
} from "../services/project.service";
import { sendSuccess } from "../utils/api-response";

export async function getAllProjectsController(_req: Request, res: Response) {
  const projects = await getAllProjectsService();
  return sendSuccess(res, projects);
}

export async function getProjectByIdController(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const project = await getProjectByIdService(id);
  return sendSuccess(res, project);
}

export async function createProjectController(req: Request, res: Response) {
  const project = await createProjectService(req.body);
  return sendSuccess(res, project, 201, "Project created successfully");
}
