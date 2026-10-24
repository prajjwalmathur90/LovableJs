import dotenv from "dotenv";
import path from "path";

// Load .env relative to server root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  API_PORT: Number(process.env.API_PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://vibe:vibe@localhost:5432/lovablejs",
};

export default env;
