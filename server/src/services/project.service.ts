import { generateSlug } from "random-word-slugs";
import { CreateProjectDto } from "../dtos/project.dto";
import {
  createProject,
  getAllProjects,
  getProjectById,
} from "../repositories/project.repository";
import { badRequest, notFound } from "../utils/api-error";

export async function getAllProjectsService() {
  return await getAllProjects();
}

export async function getProjectByIdService(id: string) {
  const project = await getProjectById(id);
  if (!project) {
    throw notFound("Project not found");
  }
  return project;
}

export async function createProjectService(data: CreateProjectDto) {
  const content = data.content || data.message;
  if (!content) {
    throw badRequest("Message content is required");
  }

  const name = data.name || generateSlug(3, { format: "kebab" });
  return await createProject(name, content);
}



