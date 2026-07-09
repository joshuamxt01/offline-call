import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { Errors } from "../lib/http-error.js";
import { db } from "../config/db.js";
import { devices } from "../db/schema.js";
import { eq } from "drizzle-orm";

/** Require a valid access token. Attaches req.auth. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Errors.unauthenticated());
  try {
    const claims = verifyAccessToken(header.slice(7));
    req.auth = { userId: claims.sub, deviceId: claims.did, role: claims.role };
    next();
  } catch {
    next(Errors.unauthenticated("Invalid or expired token"));
  }
}

/** Require the calling device to be verified (for sensitive actions). */
export async function requireVerifiedDevice(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(Errors.unauthenticated());
  const [device] = await db
    .select({ verified: devices.verified })
    .from(devices)
    .where(eq(devices.id, req.auth.deviceId))
    .limit(1);
  if (!device) return next(Errors.unauthenticated("Device not found"));
  if (!device.verified) return next(Errors.deviceUnverified());
  next();
}
