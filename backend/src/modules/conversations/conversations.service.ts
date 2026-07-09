import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { conversations, conversationMembers, messages, users } from "../../db/schema.js";
import { Errors } from "../../lib/http-error.js";
import { toUserPublic, toMessageDto } from "../../lib/mappers.js";
import { areContacts } from "../contacts/contacts.service.js";

export async function memberIds(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

export async function ensureMember(conversationId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!row) throw Errors.forbidden("Not a member of this conversation");
}

/** Find or create the 1:1 conversation between two users. Idempotent. */
export async function getOrCreateDirect(a: string, b: string): Promise<string> {
  if (a === b) throw Errors.validation("Cannot start a conversation with yourself");

  const shared = await db
    .select({ id: conversationMembers.conversationId })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversations.type, "direct"), inArray(conversationMembers.userId, [a, b])))
    .groupBy(conversationMembers.conversationId)
    .having(sql`count(distinct ${conversationMembers.userId}) = 2`);

  if (shared[0]) return shared[0].id;

  // Privacy gate: private / contacts_only users can only be messaged by accepted
  // contacts. Public users accept new conversations (they can block later).
  // (An existing conversation above is always allowed.)
  const [target] = await db
    .select({ privacy: users.privacy })
    .from(users)
    .where(eq(users.id, b))
    .limit(1);
  if (!target) throw Errors.notFound("User not found");
  if (target.privacy !== "public" && !(await areContacts(b, a))) {
    throw Errors.forbidden("This user only accepts messages from their contacts");
  }

  const [conv] = await db
    .insert(conversations)
    .values({ type: "direct", createdBy: a })
    .returning({ id: conversations.id });
  await db.insert(conversationMembers).values([
    { conversationId: conv!.id, userId: a },
    { conversationId: conv!.id, userId: b },
  ]);
  return conv!.id;
}

/** List a user's conversations with last message + unread count. */
export async function list(userId: string) {
  const memberships = await db
    .select({
      conversationId: conversationMembers.conversationId,
      lastReadMessageId: conversationMembers.lastReadMessageId,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));

  const results = [];
  for (const m of memberships) {
    const others = await db
      .select({ user: users })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(
        and(
          eq(conversationMembers.conversationId, m.conversationId),
          sql`${conversationMembers.userId} <> ${userId}`,
        ),
      );

    const [last] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, m.conversationId))
      .orderBy(sql`${messages.serverCreatedAt} desc`)
      .limit(1);

    const [unreadRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, m.conversationId),
          sql`${messages.senderId} <> ${userId}`,
          m.lastReadMessageId
            ? sql`${messages.id} > ${m.lastReadMessageId}`
            : sql`true`,
        ),
      );

    results.push({
      id: m.conversationId,
      participants: others.map((o) => toUserPublic(o.user)),
      lastMessage: last ? toMessageDto(last) : null,
      unread: unreadRow?.count ?? 0,
    });
  }
  return results;
}
