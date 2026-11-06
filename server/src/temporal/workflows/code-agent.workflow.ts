import { proxyActivities } from "@temporalio/workflow";
import * as activities from "../activities";

const { createSandbox, saveResult } = proxyActivities<typeof activities>({
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

  await saveResult({
    projectId: input.projectId,
    content: `Generated app for prompt: "${input.prompt}"`,
    title: "Generated App",
    files: {
      "src/App.tsx": `export default function App() {\n  return <div>Hello from codeAgent</div>;\n}\n`,
    },
    sandboxUrl: `/api/preview/${input.projectId}`,
  });

  return {
    files: null,
  };
}
