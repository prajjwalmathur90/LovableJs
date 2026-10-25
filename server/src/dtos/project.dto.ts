import { z } from "zod";

export const createProjectSchema = z
  .object({
    content: z.string().min(1, "Message content is required").optional(),
    message: z.string().min(1, "Message content is required").optional(),
    name: z.string().optional(),
  })
  .refine((data) => !!(data.content || data.message), {
    message: "Message content is required",
    path: ["content"],
  });

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
