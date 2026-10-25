import { Request, Response } from "express";
import { sendSuccess } from "../utils/api-response";

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(
    res,
    {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    200,
    "Server is healthy"
  );
}

