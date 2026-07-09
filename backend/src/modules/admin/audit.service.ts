import { db } from "../../config/db.js";
import { auditLog } from "../../db/schema.js";
import { logger } from "../../lib/logger.js";

/** Append a security-relevant event. Never throws into the request path. */
export async function audit(
  actorUserId: string | null,
  action: string,
  target?: string,
  ip?: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: actorUserId ?? null,
      action,
      target: target ?? null,
      ip: ip ?? null,
      metadata,
    });
  } catch (err) {
    logger.warn({ err, action }, "audit log write failed");
  }
}
