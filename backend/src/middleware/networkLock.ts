import type { NextFunction, Request, Response } from "express";
import { isIpAllowed } from "../modules/access/access.service.js";
import { HttpError } from "../lib/http-error.js";

/**
 * Blocks app requests from clients outside the admin-approved networks (when the
 * lock is on). Fail-open on internal errors so a DB hiccup never bricks the app.
 * Auth + admin routes are intentionally NOT wrapped, so users can still log in
 * and admins can always manage the lock.
 */
export async function enforceNetworkLock(req: Request, _res: Response, next: NextFunction) {
  try {
    if (await isIpAllowed(req.ip ?? "")) return next();
    return next(
      new HttpError(403, "NETWORK_RESTRICTED", "Access is restricted to approved networks on this deployment"),
    );
  } catch {
    next(); // fail-open
  }
}
