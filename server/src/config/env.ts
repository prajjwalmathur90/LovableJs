import dotenv from "dotenv";
import path from "path";

// Load root .env first, then server-specific .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

export const env = {
  API_PORT: Number(process.env.API_PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://vibe:vibe@localhost:5432/lovablejs",
  // Temporal configuration defaults for local development.
  TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE || "default",
  TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE || "lovablejs-task-queue",
};

export default env;
