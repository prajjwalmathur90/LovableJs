import { ChatGoogle } from "@langchain/google/node";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env } from "../config/env";

const GEMINI_REASONING_PREFIXES = ["gemini-2.5", "gemini-3"];
const OPENAI_REASONING_PREFIXES = ["o1", "o3", "o4"];

export function hasllm(): boolean {
  return Boolean(
    (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim() !== "") ||
    (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== ""),
  );
}

export const hasLLM = hasllm;

export function isGeminiReasoningModel(modelName: string): boolean {
  const lower = modelName.trim().toLowerCase();
  return GEMINI_REASONING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function isOpenAIReasoningModel(modelName: string): boolean {
  const lower = modelName.trim().toLowerCase();
  return OPENAI_REASONING_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function geminiChatModel(
  modelName: string,
  reasoning: boolean,
): ChatGoogle {
  const baseConfig = {
    model: modelName,
    apiKey: env.GEMINI_API_KEY,
  };

  const applyReasoning = reasoning && isGeminiReasoningModel(modelName);

  if (!applyReasoning) {
    return new ChatGoogle(baseConfig);
  }

  return new ChatGoogle({
    ...baseConfig,
    reasoningEffort: env.GEMINI_REASONING_EFFORT,
  });
}

export function openaiChatModel(
  modelName: string,
  reasoning: boolean,
): ChatOpenAI {
  const baseConfig = {
    model: modelName,
    apiKey: env.OPENAI_API_KEY,
  };

  const applyReasoning = reasoning && isOpenAIReasoningModel(modelName);

  if (!applyReasoning) {
    return new ChatOpenAI(baseConfig);
  }

  return new ChatOpenAI({
    ...baseConfig,
    reasoning: { effort: env.GEMINI_REASONING_EFFORT },
  });
}

export function getChatModel(
  modelName?: string,
  reasoning: boolean = false,
): BaseChatModel {
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim() !== "") {
    return openaiChatModel(
      modelName || env.OPENAI_MODEL || "gpt-4o",
      reasoning,
    );
  }

  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== "") {
    return geminiChatModel(
      modelName || env.GEMINI_MODEL || "gemini-2.5-flash",
      reasoning,
    );
  }

  throw new Error(
    "No LLM provider API key configured. Set OPENAI_API_KEY or GEMINI_API_KEY.",
  );
}
