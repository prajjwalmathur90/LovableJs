import {
  Message,
  MessageRole,
  MessageType,
  Fragment,
} from "../../generated/prisma/client";
import prisma from "../lib/prisma";
import { FileCollection } from "../lib/sandbox";

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

type CreateMessageInput = {
  projectId: string;
  content: string;
};

export async function createMessage(
  input: CreateMessageInput,
): Promise<Message> {
  return prisma.message.create({
    data: {
      projectId: input.projectId,
      content: input.content,
      role: MessageRole.USER,
      type: MessageType.RESULT,
    },
  });
}

type SaveResultInput = {
  projectId: string;
  content: string;
  title: string;
  files: FileCollection;
  sandboxUrl: string;
  isError?: boolean;
};

type MessageWithFragments = Message & { fragments: Fragment[] };

export async function saveResult(
  input: SaveResultInput,
): Promise<MessageWithFragments> {
  if (input.isError) {
    return prisma.message.create({
      data: {
        projectId: input.projectId,
        content: input.content,
        role: MessageRole.ASSISTANT,
        type: MessageType.ERROR,
      },
      include: {
        fragments: true,
      },
    });
  }

  return prisma.message.create({
    data: {
      projectId: input.projectId,
      content: input.content,
      role: MessageRole.ASSISTANT,
      type: MessageType.RESULT,
      fragments: {
        create: {
          title: input.title,
          sandboxUrl: input.sandboxUrl,
          files: input.files,
        },
      },
    },
    include: {
      fragments: true,
    },
  });
}
