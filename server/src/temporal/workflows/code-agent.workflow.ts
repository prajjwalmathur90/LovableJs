import { proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities";

const { createSandbox, saveResult, generateTitle, generateResponse } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "10 minutes",
    retry: {
      maximumAttempts: 3,
    },
  });

export type CodeAgentInput = {
  projectId: string;
  prompt: string;
};

export async function codeAgentWorkflow(input: CodeAgentInput) {
  await createSandbox(input.projectId);

  const SAMPLE_SUMMARY = "A custom React app tailored to create TODO list app";
  const title = await generateTitle(SAMPLE_SUMMARY);
  const response = await generateResponse(SAMPLE_SUMMARY);

  await saveResult({
    projectId: input.projectId,
    content: response,
    title,
    files: {
      "src/App.tsx": `export default function App() {\n  return <div>Hello from codeAgent</div>;\n}\n`,
    },
    sandboxUrl: `/api/preview/${input.projectId}`,
  });

  return {
    files: null,
  };
}
