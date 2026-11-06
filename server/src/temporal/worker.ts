import { NativeConnection, Worker } from "@temporalio/worker";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import * as activities from "./activities";

const workflowsPath = `${__dirname}/workflows`;

export async function connect(
  maxAttempts = 5,
  initialDelayMs = 1000,
  backoffFactor = 2,
): Promise<NativeConnection> {
  return withRetry(
    `Connecting to Temporal at ${env.TEMPORAL_ADDRESS}`,
    () => NativeConnection.connect({ address: env.TEMPORAL_ADDRESS }),
    { maxAttempts, initialDelayMs, backoffFactor },
  );
}

async function run() {
  const connection = await connect();

  const worker = await Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_TASK_QUEUE,
    workflowsPath,
    activities,
  });

  console.log(
    "Temporal worker started – listening on task queue:",
    env.TEMPORAL_TASK_QUEUE,
  );

  try {
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error("Temporal worker failed:", err);
  process.exit(1);
});
