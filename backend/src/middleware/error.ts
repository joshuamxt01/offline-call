import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError, Errors } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import type { ApiError } from "@nexa/shared";

export function notFound(_req: Request, res: Response) {
  const body: ApiError = { error: { code: "NOT_FOUND", message: "Route not found" } };
  res.status(404).json(body);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let httpError: HttpError;

  if (err instanceof HttpError) {
    httpError = err;
  } else if (err instanceof ZodError) {
    httpError = Errors.validation(err.flatten());
  } else {
    logger.error(err, "Unhandled error");
    httpError = Errors.internal();
  }

  if (httpError.retryAfter) res.setHeader("Retry-After", String(httpError.retryAfter));

  const body: ApiError = {
    error: {
      code: httpError.code,
      message: httpError.message,
      details: httpError.details,
      retryAfter: httpError.retryAfter,
    },
  };
  res.status(httpError.status).json(body);
}

/** Wrap async route handlers so thrown errors reach the error middleware. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as T, res, next).catch(next);
  };
}
