import { defineSignal, setHandler } from "@temporalio/workflow";

export const pongSignal = defineSignal("pong");

export async function pingWorkflow(): Promise<string> {
  console.log("pingWorkflow started");

  let ponged = false;

  setHandler(pongSignal, () => {
    ponged = true;
  });

  // Simple workflow: immediately return a ping response.
  // Extend this to wait for signals, perform activities, etc.
  return `pong – ${ponged ? "acknowledged" : "returned immediately"}`;
}

