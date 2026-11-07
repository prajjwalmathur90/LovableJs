import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from "./model";

export async function runPlainPrompt(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const model = getChatModel();

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  if (typeof response?.content === "string") {
    return response.content.trim();
  }

  return "";
}
