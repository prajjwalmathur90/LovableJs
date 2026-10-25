import { Router } from "express";
import { getMessagesByProjectIdController } from "../controllers/message.controller";
import {
  createProjectController,
  getAllProjectsController,
  getProjectByIdController,
} from "../controllers/project.controller";
import { createProjectSchema } from "../dtos/project.dto";
import { validateBody, validateId } from "../middleware";

const projectRouter = Router();

projectRouter.get("/", getAllProjectsController);
projectRouter.get("/:id", validateId(), getProjectByIdController);
projectRouter.get(
  "/:projectId/messages",
  validateId("projectId"),
  getMessagesByProjectIdController,
);
projectRouter.post(
  "/",
  validateBody(createProjectSchema),
  createProjectController,
);

export default projectRouter;
