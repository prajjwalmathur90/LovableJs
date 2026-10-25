import { Router } from "express";
import { getMessagesByProjectIdController } from "../controllers/message.controller";
import { validateId } from "../middleware";

const messageRouter = Router();

messageRouter.get(
  "/:projectId",
  validateId("projectId"),
  getMessagesByProjectIdController,
);

export default messageRouter;

