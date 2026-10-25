import { LOCAL_USER_ID } from "../config/constants";
import prisma from "../lib/prisma";

export async function getMessagesByProjectId(projectId: string) {
  return await prisma.message.findMany({
    where: {
      projectId,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      fragments: true,
    },
  });
}
