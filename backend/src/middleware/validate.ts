import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { Errors } from "../lib/http-error.js";

type Source = "body" | "query" | "params";

/**
 * Validate a request part against a Zod schema, replacing it with the parsed
 * (typed, coerced) value. Access parsed data via res.locals[`valid_${source}`]
 * or the typed helpers below.
 */
export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(Errors.validation(result.error.flatten()));
    res.locals[`valid_${source}`] = result.data;
    next();
  };
}

export function valid<T extends ZodTypeAny>(res: Response, source: Source = "body"): ZodInfer<T> {
  return res.locals[`valid_${source}`] as ZodInfer<T>;
}
