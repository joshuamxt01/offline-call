import { randomUUID, randomBytes, createHash } from "node:crypto";
import { ulid } from "ulid";

export const uuid = (): string => randomUUID();
export const newUlid = (): string => ulid();

/** Numeric device-verification code (dev-friendly; SMS/email in prod). */
export const verifyCode = (): string =>
  String(Math.floor(100000 + (randomBytes(4).readUInt32BE(0) % 900000)));

/** Opaque, URL-safe token (used as the raw refresh token). */
export const opaqueToken = (): string => randomBytes(48).toString("base64url");

/** SHA-256 hex — used to store refresh tokens as hashes, never raw. */
export const sha256 = (input: string): string =>
  createHash("sha256").update(input).digest("hex");
