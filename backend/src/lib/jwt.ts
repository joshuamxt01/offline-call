import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { UserRole } from "@nexa/shared";

export interface AccessClaims {
  sub: string; // userId
  did: string; // deviceId
  role: UserRole;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: "nexa",
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "nexa" });
  if (typeof decoded === "string") throw new Error("Invalid token");
  const { sub, did, role } = decoded as jwt.JwtPayload & AccessClaims;
  if (!sub || !did || !role) throw new Error("Malformed token");
  return { sub, did, role };
}
