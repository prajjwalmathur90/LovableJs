import { runPlainPrompt } from "../../lib/llm";
import { FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT } from "../../lib/prompt";

export async function generateTitle(summary: string) {
  const title = await runPlainPrompt(FRAGMENT_TITLE_PROMPT, summary);
  return title
    ?.replace(/["'`“”]/g, "")
    .trim()
    .slice(0, 40);
}

export async function generateResponse(summary: string) {
  return await runPlainPrompt(RESPONSE_PROMPT, summary);
}
