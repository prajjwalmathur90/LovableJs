import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { badRequest } from "../utils/api-error";

export const idSchema = z.string().min(1, "ID is required");
export const uuidSchema = z.string().uuid("Invalid UUID format");

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
      return next(badRequest("Request body is required"));
    }

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        badRequest(
          result.error.issues[0]?.message || "Invalid request body",
          result.error.issues
        )
      );
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        badRequest(
          result.error.issues[0]?.message || "Invalid query parameters",
          result.error.issues
        )
      );
    }
    req.query = result.data as any;
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(
        badRequest(
          result.error.issues[0]?.message || "Invalid request parameters",
          result.error.issues
        )
      );
    }
    req.params = result.data as any;
    next();
  };
}

export function validateId(
  paramName: string = "id",
  schema: z.ZodTypeAny = z.string().min(1, `${paramName} is required`)
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const result = schema.safeParse(value);
    if (!result.success) {
      return next(
        badRequest(
          result.error.issues[0]?.message || `Invalid or missing parameter: ${paramName}`,
          result.error.issues
        )
      );
    }
    req.params[paramName] = result.data as string;
    next();
  };
}

export interface RequestValidationSchemas {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

export function validateRequest(schemas: RequestValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        return next(
          badRequest(
            result.error.issues[0]?.message || "Invalid request parameters",
            result.error.issues
          )
        );
      }
      req.params = result.data as any;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        return next(
          badRequest(
            result.error.issues[0]?.message || "Invalid query parameters",
            result.error.issues
          )
        );
      }
      req.query = result.data as any;
    }

    if (schemas.body) {
      if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
        return next(badRequest("Request body is required"));
      }

      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        return next(
          badRequest(
            result.error.issues[0]?.message || "Invalid request body",
            result.error.issues
          )
        );
      }
      req.body = result.data;
    }

    next();
  };
}

