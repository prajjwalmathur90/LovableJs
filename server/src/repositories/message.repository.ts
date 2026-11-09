import {
  Message,
  MessageRole,
  MessageType,
  Fragment,
} from "../../generated/prisma/client";
import prisma from "../lib/prisma";
import { FileCollection } from "../lib/sandbox";
import { AgentChatMessage } from "../agents/types";
import { formatPlanForAgent, parsePlanMessage } from "../lib/plan";

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

function formatLoadedDbContent(content: string): string {
  const todos = parsePlanMessage(content);
  return todos ? formatPlanForAgent(todos) : content;
}

export async function loadMessages(
  projectId: string,
  limit = 5,
): Promise<AgentChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      projectId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return messages.reverse().map((message) => ({
    role: message.role === MessageRole.USER ? "user" : "assistant",
    content: formatLoadedDbContent(message.content),
  }));
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
