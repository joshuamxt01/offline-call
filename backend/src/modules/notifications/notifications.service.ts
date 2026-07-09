import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { notifications } from "../../db/schema.js";
import { emitToUser } from "../../realtime/emitter.js";
import { logger } from "../../lib/logger.js";
import { ServerEvents } from "@nexa/shared";
import type { NotificationDto } from "@nexa/shared";

function toDto(n: typeof notifications.$inferSelect): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    actorId: n.actorId,
    payload: (n.payload as Record<string, unknown>) ?? {},
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Persist a notification and push it live. Never throws into the caller. */
export async function notify(
  userId: string,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const [row] = await db
      .insert(notifications)
      .values({ userId, type, actorId, payload })
      .returning();
    if (row) emitToUser(userId, ServerEvents.NotificationNew, toDto(row));
  } catch (err) {
    logger.warn({ err, type }, "notification write failed");
  }
}

export async function listFor(userId: string, limit = 50): Promise<NotificationDto[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(limit, 100));
  return rows.map(toDto);
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.c ?? 0;
}

export async function markRead(userId: string, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
