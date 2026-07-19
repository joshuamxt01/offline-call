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
  // STUN-only fallback = direct peer-to-peer. This is how calls originally worked
  // on the same network, and it's what we hand out unless a relay is verified.
  const stun = env.TURN_URLS.filter((u) => u.startsWith("stun:"));
  const stunOnly: TurnCredentials = {
    urls: stun.length ? stun : ["stun:stun.l.google.com:19302"],
    username: "",
    credential: "",
    ttl: env.TURN_TTL,
  };

  // A TURN relay is only needed for calls BETWEEN different networks, and a
  // BROKEN relay actively blocks same-network calls that would otherwise connect
  // directly. So only hand out a relay when it's been explicitly enabled (i.e.
  // its credentials are verified working). Default = STUN-only.
  if (env.TURN_ENABLED !== "true") return stunOnly;

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
