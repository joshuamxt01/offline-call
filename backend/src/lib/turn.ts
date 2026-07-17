import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import type { TurnCredentials } from "@nexa/shared";

/**
 * coturn "REST API" time-limited credentials (RFC-style).
 *   username   = <unixExpiry>:<userId>
 *   credential = base64( HMAC-SHA1( TURN_SECRET, username ) )
 * The TURN server validates this against its static-auth-secret.
 * Credentials are short-lived and never reused — no static TURN passwords.
 */
export function issueTurnCredentials(userId: string, nowSeconds: number): TurnCredentials {
  // A hosted TURN relay (Open Relay / Metered / Twilio) uses static credentials —
  // return them directly so calls get a working relay (needed for mobile/CGNAT).
  if (env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    return {
      urls: env.TURN_URLS,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
      ttl: env.TURN_TTL,
    };
  }

  // Otherwise generate coturn "REST API" time-limited credentials.
  const expiry = nowSeconds + env.TURN_TTL;
  const username = `${expiry}:${userId}`;
  const credential = createHmac("sha1", env.TURN_SECRET)
    .update(username)
    .digest("base64");

  return {
    urls: env.TURN_URLS,
    username,
    credential,
    ttl: env.TURN_TTL,
  };
}
