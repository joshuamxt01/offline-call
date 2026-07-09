import { and, eq, gt, lt, ne, sql, inArray } from "drizzle-orm";
import { db } from "../../config/db.js";
import { messages, messageReceipts, conversationMembers } from "../../db/schema.js";
import { memberIds, ensureMember } from "../conversations/conversations.service.js";
import { toMessageDto } from "../../lib/mappers.js";
import type { MessageDto, MessageType } from "@nexa/shared";

export interface PersistInput {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  ciphertext: string; // base64
  nonce: string; // base64
  mediaObjectId?: string | null;
  clientCreatedAt: string;
}

/**
 * Persist a message idempotently (client-authored ULID id). Creates delivery
 * receipts for every other member. Returns the stored message + recipient ids
 * so the caller (REST or Socket.IO) can fan it out.
 */
export async function persist(
  input: PersistInput,
): Promise<{ message: MessageDto; recipients: string[] }> {
  await ensureMember(input.conversationId, input.senderId);

  const [row] = await db
    .insert(messages)
    .values({
      id: input.id,
      conversationId: input.conversationId,
      senderId: input.senderId,
      type: input.type,
      ciphertext: Buffer.from(input.ciphertext, "base64"),
      nonce: Buffer.from(input.nonce, "base64"),
      mediaObjectId: input.mediaObjectId ?? null,
      clientCreatedAt: new Date(input.clientCreatedAt),
      status: "sent",
    })
    .onConflictDoNothing({ target: messages.id })
    .returning();

  const members = await memberIds(input.conversationId);
  const recipients = members.filter((m) => m !== input.senderId);

  // Fresh insert → create receipt rows. On conflict (duplicate delivery), reuse existing.
  if (row) {
    if (recipients.length) {
      await db
        .insert(messageReceipts)
        .values(recipients.map((userId) => ({ messageId: row.id, userId })))
        .onConflictDoNothing();
    }
    return { message: toMessageDto(row), recipients };
  }

  // Duplicate: return the already-stored message.
  const [existing] = await db.select().from(messages).where(eq(messages.id, input.id)).limit(1);
  return { message: toMessageDto(existing!), recipients };
}

export async function history(
  conversationId: string,
  userId: string,
  before?: string,
  limit = 50,
): Promise<MessageDto[]> {
  await ensureMember(conversationId, userId);
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        before ? lt(messages.id, before) : undefined,
      ),
    )
    .orderBy(sql`${messages.serverCreatedAt} desc`)
    .limit(Math.min(limit, 100));
  return rows.map(toMessageDto).reverse();
}

export async function getMeta(
  messageId: string,
): Promise<{ conversationId: string; senderId: string } | null> {
  const [row] = await db
    .select({ conversationId: messages.conversationId, senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  return row ?? null;
}

export async function markDelivered(messageId: string, userId: string): Promise<void> {
  await db
    .update(messageReceipts)
    .set({ deliveredAt: new Date() })
    .where(
      and(
        eq(messageReceipts.messageId, messageId),
        eq(messageReceipts.userId, userId),
        sql`${messageReceipts.deliveredAt} is null`,
      ),
    );
  await db
    .update(messages)
    .set({ status: "delivered" })
    .where(and(eq(messages.id, messageId), eq(messages.status, "sent")));
}

export async function markRead(
  conversationId: string,
  userId: string,
  upToMessageId: string,
): Promise<void> {
  await ensureMember(conversationId, userId);
  // Mark all this user's receipts in the conversation up to the cursor as read.
  const ids = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.id} <= ${upToMessageId}`,
        ne(messages.senderId, userId),
      ),
    );
  if (ids.length) {
    await db
      .update(messageReceipts)
      .set({ readAt: new Date() })
      .where(
        and(
          inArray(messageReceipts.messageId, ids.map((r) => r.id)),
          eq(messageReceipts.userId, userId),
          sql`${messageReceipts.readAt} is null`,
        ),
      );
  }
  await db
    .update(conversationMembers)
    .set({ lastReadMessageId: upToMessageId })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    );
}

/** Bulk push queued offline messages (dedup by id). */
export async function syncPush(
  senderId: string,
  batch: Array<Omit<PersistInput, "senderId">>,
): Promise<{ accepted: string[] }> {
  const accepted: string[] = [];
  for (const m of batch) {
    try {
      await persist({ ...m, senderId });
      accepted.push(m.id);
    } catch {
      // skip messages the sender isn't authorized for; continue the batch
    }
  }
  return { accepted };
}

/** Pull messages the user missed since a cursor (server_created_at ISO). */
export async function syncPull(userId: string, sinceIso?: string): Promise<MessageDto[]> {
  const since = sinceIso ? new Date(sinceIso) : new Date(0);
  const convs = await db
    .select({ id: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));
  if (!convs.length) return [];

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, convs.map((c) => c.id)),
        gt(messages.serverCreatedAt, since),
      ),
    )
    .orderBy(sql`${messages.serverCreatedAt} asc`)
    .limit(500);
  return rows.map(toMessageDto);
}
