import { Router } from "express";
import { getHealth } from "../controllers/health.controller";
import projectRouter from "./project.router";

const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.use("/projects", projectRouter);

export default apiRouter;
