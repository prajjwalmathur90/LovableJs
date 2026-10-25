import { LOCAL_USER_ID } from "../config/constants";
import prisma from "../lib/prisma";

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
