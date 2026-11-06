import { generateSlug } from "random-word-slugs";
import { CreateProjectDto } from "../dtos/project.dto";
import {
  createProject,
  getAllProjects,
  getProjectById,
} from "../repositories/project.repository";
import { notFound } from "../utils/api-error";
import { FileCollection } from "../lib/sandbox";
import { startCodeAgentWorkflow } from "../temporal/client";

const HELLO_WORLD_FILES: FileCollection = {
  "src/App.tsx": `export default function App() {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
}
`,
};

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

  const name = data.name || generateSlug(3, { format: "kebab" });
  const project = await createProject(name, content!);

  await startCodeAgentWorkflow({
    projectId: project.id,
    prompt: content!,
  });

  return project;
}
