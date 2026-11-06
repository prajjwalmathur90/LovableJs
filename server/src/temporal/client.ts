import { Client, Connection } from "@temporalio/client";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import { pingWorkflow } from "./workflows/ping.workflow";
import {
  codeAgentWorkflow,
  type CodeAgentInput,
} from "./workflows/code-agent.workflow";

export async function connect(
  maxAttempts = 5,
  initialDelayMs = 1000,
  backoffFactor = 2,
): Promise<Client> {
  return withRetry(
    `Connecting Temporal client to ${env.TEMPORAL_ADDRESS}`,
    async () => {
      const connection = await Connection.connect({
        address: env.TEMPORAL_ADDRESS,
      });
      return new Client({ connection, namespace: env.TEMPORAL_NAMESPACE });
    },
    { maxAttempts, initialDelayMs, backoffFactor },
  );
}

export async function startPing(): Promise<void> {
  const client = await connect();

  try {
    const workflowId = `ping-${Date.now()}`;

    const handle = await client.workflow.start(pingWorkflow, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
    });

    console.log(`Started pingWorkflow with workflowId: ${handle.workflowId}`);

    const result = await handle.result();

    console.log("pingWorkflow result:", result);
  } finally {
    await client.connection.close();
  }
}

export async function createCodeAgentWorkflow(input: CodeAgentInput) {
  const client = await connect();

  try {
    const workflowId = `code-agent-${input.projectId}-${Date.now()}`;

    const handle = await client.workflow.start(codeAgentWorkflow, {
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowId,
      args: [input],
    });

    console.log(
      `Started codeAgentWorkflow with workflowId: ${handle.workflowId}`,
    );

    const result = await handle.result();

    console.log("codeAgentWorkflow result:", result);
    return result;
  } finally {
    await client.connection.close();
  }
}

export const startCodeAgentWorkflow = createCodeAgentWorkflow;

