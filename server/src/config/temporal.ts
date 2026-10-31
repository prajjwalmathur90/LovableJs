import { Client, Connection } from "@temporalio/client";
import { env } from "./env";

let clientInstance: Client | null = null;

export function getTemporalClient(): Client {
  if (!clientInstance) {
    clientInstance = new Client({
      connection: Connection.lazy({ address: env.TEMPORAL_ADDRESS }),
      namespace: env.TEMPORAL_NAMESPACE,
    });
  }
  return clientInstance;
}

export async function closeTemporalClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.connection.close();
    clientInstance = null;
  }
}
