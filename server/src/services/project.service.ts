import { generateSlug } from "random-word-slugs";
import { CreateProjectDto } from "../dtos/project.dto";
import {
  createProject,
  getAllProjects,
  getProjectById,
} from "../repositories/project.repository";
import { badRequest, notFound } from "../utils/api-error";
import { FileCollection, writeSandboxFiles } from "../lib/sandbox";
import { saveResult } from "../repositories/message.repository";

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
  if (!content) {
    throw badRequest("Message content is required");
  }

  const name = data.name || generateSlug(3, { format: "kebab" });
  const project = await createProject(name, content);

  await writeSandboxFiles(project.id, HELLO_WORLD_FILES);
  await saveResult({
    projectId: project.id,
    content: "Here is a hello world sandbox",
    sandboxUrl: `/api/preview/${project.id}`,
    title: "Hello World",
    files: HELLO_WORLD_FILES,
    isError: false,
  });

  return project;
}
