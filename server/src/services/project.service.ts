import { getAllProjects } from "../repositories/project.repository";

export async function getAllProjectsService() {
  return getAllProjects();
}
