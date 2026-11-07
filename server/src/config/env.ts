import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

export const VALID_REASONING_EFFORTS = [
  "minimal",
  "low",
  "medium",
  "high",
] as const;

export type ReasoningEffort = (typeof VALID_REASONING_EFFORTS)[number];

function resolveReasoningEffort(value?: string): ReasoningEffort {
  const raw = (value || "").trim().toLowerCase();

  if ((VALID_REASONING_EFFORTS as readonly string[]).includes(raw)) {
    return raw as ReasoningEffort;
  }

  if (value) {
    console.warn(
      `Invalid GEMINI_REASONING_EFFORT "${value}". ` +
        `Supported values: ${VALID_REASONING_EFFORTS.join(", ")}. ` +
        `Defaulting to medium.`,
    );
  }

  return "medium";
}

export const env = {
  API_PORT: Number(process.env.API_PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://vibe:vibe@localhost:5432/lovablejs",
  TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE || "default",
  TEMPORAL_TASK_QUEUE:
    process.env.TEMPORAL_TASK_QUEUE || "lovablejs-task-queue",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",
  GEMINI_REASONING_EFFORT: resolveReasoningEffort(
    process.env.GEMINI_REASONING_EFFORT,
  ),
};

export default env;
