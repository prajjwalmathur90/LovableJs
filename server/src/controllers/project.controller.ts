import { Request, Response } from "express";
import { getAllProjectsService } from "../services/project.service";

export async function getAllProjectsController(_req: Request, res: Response) {
  try {
    const projects = await getAllProjectsService();
    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
