import express, { Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    message: "Server is healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(env.API_PORT, () => {
  console.log(`Server is running on port ${env.API_PORT}`);
});

export default app;
