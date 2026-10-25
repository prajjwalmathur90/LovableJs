import { LOCAL_USER_ID } from "../config/constants";
import prisma, { MessageRole, MessageType } from "../lib/prisma";

export async function getAllProjects() {
  return await prisma.project.findMany({
    where: {
      userId: LOCAL_USER_ID,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getProjectById(id: string) {
  return await prisma.project.findFirst({
    where: {
      id,
      userId: LOCAL_USER_ID,
    },
  });
}

export async function createProject(name: string, content: string) {
  return await prisma.project.create({
    data: {
      name,
      userId: LOCAL_USER_ID,
      messages: {
        create: {
          content,
          role: MessageRole.USER,
          type: MessageType.RESULT,
        },
      },
    },
    include: {
      messages: true,
    },
  });
}


