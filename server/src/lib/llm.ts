import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel, hasllm } from "./model";

export async function runPlainPrompt(
  systemPrompt: string,
  userPrompt: string,
  options: {
    modelName?: string;
    reasoning?: boolean;
  } = {},
): Promise<string | null> {
  if (!hasllm()) {
    return null;
  }

  const model = getChatModel(options?.modelName, options?.reasoning);

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  if (typeof response?.content === "string") {
    const trimmed = response.content.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}
