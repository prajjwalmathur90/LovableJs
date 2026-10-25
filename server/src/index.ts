import express from "express";
import cors from "cors";
import { env } from "./config/env";
import apiRouter from "./routes/api";
import { routeNotFound } from "./middleware/route-not-found";
import { errorHandler } from "./middleware/error-handler";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", apiRouter);

app.listen(env.API_PORT, () => {
  console.log(`Server is running on port ${env.API_PORT}`);
});

app.use(routeNotFound);
app.use(errorHandler);

export default app;
