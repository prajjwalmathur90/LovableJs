import { Router } from "express";
import { getAllProjectsController } from "../controllers/project.controller";

const projectRouter = Router();

projectRouter.get("/", getAllProjectsController);

export default projectRouter;
