import type { NextFunction, Request, Response } from "express";
import { Errors } from "../lib/http-error.js";
import type { UserRole } from "@nexa/shared";

/** Restrict a route to specific roles (RBAC). Must run after requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthenticated());
    if (!roles.includes(req.auth.role)) return next(Errors.forbidden());
    next();
  };
}
