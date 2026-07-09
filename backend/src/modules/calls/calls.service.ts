import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { calls, callParticipants } from "../../db/schema.js";
import { Errors } from "../../lib/http-error.js";
import { toCallDto } from "../../lib/mappers.js";
import type { CallDto, CallType, CallTransport } from "@nexa/shared";

export async function createCall(params: {
  callId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  conversationId?: string | null;
}): Promise<CallDto> {
  const [row] = await db
    .insert(calls)
    .values({
      id: params.callId,
      callerId: params.callerId,
      conversationId: params.conversationId ?? null,
      type: params.type,
      status: "ringing",
    })
    .returning();
  await db.insert(callParticipants).values([
    { callId: row!.id, userId: params.callerId, joinedAt: new Date() },
    { callId: row!.id, userId: params.calleeId },
  ]);
  return toCallDto(row!);
}

export async function markAnswered(callId: string, transport?: CallTransport): Promise<void> {
  await db
    .update(calls)
    .set({ status: "answered", answeredAt: new Date(), transport: transport ?? null })
    .where(and(eq(calls.id, callId), eq(calls.status, "ringing")));
}

export async function markEnded(callId: string, reason = "hangup"): Promise<CallDto | null> {
  const [row] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!row) return null;

  const now = new Date();
  const answered = row.answeredAt ?? null;
  const status = answered ? "ended" : "missed";
  const duration = answered ? Math.max(0, Math.round((now.getTime() - answered.getTime()) / 1000)) : 0;

  const [updated] = await db
    .update(calls)
    .set({ status, endedAt: now, durationSeconds: duration, endReason: reason })
    .where(eq(calls.id, callId))
    .returning();
  return updated ? toCallDto(updated) : null;
}

export async function markRejected(callId: string): Promise<void> {
  await db
    .update(calls)
    .set({ status: "rejected", endedAt: new Date(), endReason: "rejected" })
    .where(and(eq(calls.id, callId), eq(calls.status, "ringing")));
}

export async function setTransport(callId: string, transport: CallTransport): Promise<void> {
  await db.update(calls).set({ transport }).where(eq(calls.id, callId));
}

export async function history(userId: string, before?: string, limit = 50): Promise<CallDto[]> {
  const rows = await db
    .select({ call: calls })
    .from(calls)
    .innerJoin(callParticipants, eq(callParticipants.callId, calls.id))
    .where(
      and(
        eq(callParticipants.userId, userId),
        before ? lt(calls.startedAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(sql`${calls.startedAt} desc`)
    .limit(Math.min(limit, 100));
  return rows.map((r) => toCallDto(r.call));
}

export async function getById(userId: string, callId: string): Promise<CallDto> {
  const [row] = await db
    .select({ call: calls })
    .from(calls)
    .innerJoin(callParticipants, eq(callParticipants.callId, calls.id))
    .where(and(eq(calls.id, callId), eq(callParticipants.userId, userId)))
    .limit(1);
  if (!row) throw Errors.notFound("Call not found");
  return toCallDto(row.call);
}

/** Which user is the counterpart in a 1:1 call (for signaling routing). */
export async function counterpart(callId: string, self: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: callParticipants.userId })
    .from(callParticipants)
    .where(and(eq(callParticipants.callId, callId), sql`${callParticipants.userId} <> ${self}`))
    .limit(1);
  return row?.userId ?? null;
}

/** Verify the user is a participant (authorization for signaling). */
export async function isParticipant(callId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: callParticipants.userId })
    .from(callParticipants)
    .where(and(eq(callParticipants.callId, callId), eq(callParticipants.userId, userId)))
    .limit(1);
  return Boolean(row);
}
