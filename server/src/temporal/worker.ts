import { NativeConnection, Worker } from "@temporalio/worker";
import { env } from "../config/env";
import * as activities from "./activities";

const workflowsPath = `${__dirname}/workflows`;

async function run() {
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

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
