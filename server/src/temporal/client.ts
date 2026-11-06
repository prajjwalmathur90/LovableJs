import { Client, Connection } from "@temporalio/client";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import { pingWorkflow } from "./workflows/ping.workflow";

async function connect(
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
