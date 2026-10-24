import express from "express";
import cors from "cors";
import { env } from "./config/env";
import apiRouter from "./routes/api";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", apiRouter);

app.listen(env.API_PORT, () => {
  console.log(`Server is running on port ${env.API_PORT}`);
});

export default app;
