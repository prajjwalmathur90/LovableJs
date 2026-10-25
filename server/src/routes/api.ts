import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import messageRouter from "./message.router";
import projectRouter from "./project.router";

const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.use("/projects", projectRouter);
apiRouter.use("/messages", messageRouter);

export default apiRouter;

