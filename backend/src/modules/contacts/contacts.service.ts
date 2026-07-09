import { and, eq, or } from "drizzle-orm";
import { db } from "../../config/db.js";
import { contacts, users } from "../../db/schema.js";
import { Errors } from "../../lib/http-error.js";
import { toUserPublic } from "../../lib/mappers.js";
import { presenceFor } from "../../lib/presence.js";
import { emitToUser } from "../../realtime/emitter.js";
import { ServerEvents } from "@nexa/shared";
import type { ContactDto, ContactState, PresenceState } from "@nexa/shared";
import { notify } from "../notifications/notifications.service.js";

function derivePresence(online: boolean, statusKind: string | null): PresenceState {
  if (!online) return "offline";
  if (statusKind === "busy" || statusKind === "dnd" || statusKind === "in_meeting") return "busy";
  if (statusKind === "away") return "away";
  return "online";
}

function toContactDto(
  contact: typeof contacts.$inferSelect,
  user: typeof users.$inferSelect,
  selfId: string,
  online: boolean,
  lastSeen: string | null,
): ContactDto {
  return {
    id: contact.id,
    user: toUserPublic(user),
    alias: contact.alias,
    state: contact.state as ContactState,
    incoming: contact.state === "pending" && contact.requestedBy !== selfId,
    favorite: contact.favorite,
    pinned: contact.pinned,
    online,
    presence: derivePresence(online, user.statusKind),
    lastSeen,
  };
}

export async function list(ownerId: string): Promise<ContactDto[]> {
  const rows = await db
    .select({ contact: contacts, user: users })
    .from(contacts)
    .innerJoin(users, eq(users.id, contacts.contactUserId))
    .where(eq(contacts.ownerId, ownerId));

  const presence = await presenceFor(rows.map((r) => r.user.id));
  return rows.map(({ contact, user }) => {
    const p = presence.get(user.id);
    return toContactDto(contact, user, ownerId, p?.online ?? false, p?.lastSeen ?? null);
  });
}

export async function create(ownerId: string, contactUserId: string): Promise<ContactDto> {
  if (ownerId === contactUserId) throw Errors.validation("Cannot add yourself");
  const [target] = await db.select().from(users).where(eq(users.id, contactUserId)).limit(1);
  if (!target || target.status !== "active") throw Errors.notFound("User not found");

  const existing = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.ownerId, ownerId), eq(contacts.contactUserId, contactUserId)))
    .limit(1);
  if (existing[0]) {
    if (existing[0].state === "blocked") throw Errors.forbidden("You have blocked this user");
    throw Errors.conflict("Contact or request already exists");
  }

  // Blocked by the target? Don't reveal — behave like the user can't be added.
  const [reverseBlock] = await db
    .select({ state: contacts.state })
    .from(contacts)
    .where(and(eq(contacts.ownerId, contactUserId), eq(contacts.contactUserId, ownerId), eq(contacts.state, "blocked")))
    .limit(1);
  if (reverseBlock) throw Errors.forbidden("Cannot send a request to this user");

  // My outgoing (pending) + the target's incoming (pending) — both tagged with who requested.
  const [row] = await db
    .insert(contacts)
    .values({ ownerId, contactUserId, state: "pending", requestedBy: ownerId })
    .returning();
  await db
    .insert(contacts)
    .values({ ownerId: contactUserId, contactUserId: ownerId, state: "pending", requestedBy: ownerId })
    .onConflictDoNothing();

  await notify(contactUserId, "contact_request", ownerId, { username: (await selfUsername(ownerId)) });
  emitToUser(contactUserId, ServerEvents.PresenceUpdate, { type: "contact_request", from: ownerId });

  return toContactDto(row!, target, ownerId, false, null);
}

/** Accept or reject a pending INCOMING request (a row where someone else requested me). */
export async function respond(ownerId: string, contactId: string, accept: boolean): Promise<ContactDto> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)))
    .limit(1);
  if (!row) throw Errors.notFound("Request not found");
  if (row.state !== "pending" || row.requestedBy === ownerId) {
    throw Errors.validation("Not an incoming pending request");
  }

  if (accept) {
    const [updated] = await db
      .update(contacts)
      .set({ state: "accepted", updatedAt: new Date() })
      .where(eq(contacts.id, contactId))
      .returning();
    await db
      .update(contacts)
      .set({ state: "accepted", updatedAt: new Date() })
      .where(and(eq(contacts.ownerId, row.contactUserId), eq(contacts.contactUserId, ownerId)));

    await notify(row.contactUserId, "request_accepted", ownerId, {});
    emitToUser(row.contactUserId, ServerEvents.PresenceUpdate, { type: "request_accepted", from: ownerId });

    const [user] = await db.select().from(users).where(eq(users.id, row.contactUserId)).limit(1);
    const p = (await presenceFor([row.contactUserId])).get(row.contactUserId);
    return toContactDto(updated!, user!, ownerId, p?.online ?? false, p?.lastSeen ?? null);
  }

  // Reject → remove both pending rows.
  await db.delete(contacts).where(eq(contacts.id, contactId));
  await db
    .delete(contacts)
    .where(and(eq(contacts.ownerId, row.contactUserId), eq(contacts.contactUserId, ownerId), eq(contacts.state, "pending")));
  await notify(row.contactUserId, "request_rejected", ownerId, {});
  const [user] = await db.select().from(users).where(eq(users.id, row.contactUserId)).limit(1);
  return toContactDto({ ...row, state: "pending" }, user!, ownerId, false, null);
}

/** Cancel my OUTGOING pending request. */
export async function cancel(ownerId: string, contactId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)))
    .limit(1);
  if (!row) throw Errors.notFound("Request not found");
  if (row.state !== "pending" || row.requestedBy !== ownerId) {
    throw Errors.validation("Not an outgoing pending request");
  }
  await db.delete(contacts).where(eq(contacts.id, contactId));
  await db
    .delete(contacts)
    .where(and(eq(contacts.ownerId, row.contactUserId), eq(contacts.contactUserId, ownerId), eq(contacts.state, "pending")));
}

export async function update(
  ownerId: string,
  contactId: string,
  patch: { state?: "accepted" | "blocked"; alias?: string; favorite?: boolean; pinned?: boolean },
): Promise<ContactDto> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)))
    .limit(1);
  if (!row) throw Errors.notFound("Contact not found");

  const [updated] = await db
    .update(contacts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(contacts.id, contactId))
    .returning();

  if (patch.state === "accepted") {
    await db
      .update(contacts)
      .set({ state: "accepted", updatedAt: new Date() })
      .where(and(eq(contacts.ownerId, row.contactUserId), eq(contacts.contactUserId, ownerId)));
  }
  if (patch.state === "blocked") {
    // Remove the other side's link so they no longer count me as a contact.
    await db
      .delete(contacts)
      .where(and(eq(contacts.ownerId, row.contactUserId), eq(contacts.contactUserId, ownerId)));
  }

  const [user] = await db.select().from(users).where(eq(users.id, row.contactUserId)).limit(1);
  const p = (await presenceFor([row.contactUserId])).get(row.contactUserId);
  return toContactDto(updated!, user!, ownerId, p?.online ?? false, p?.lastSeen ?? null);
}

/** Block a user by their userId (creates/updates the block row). */
export async function block(ownerId: string, targetUserId: string): Promise<void> {
  if (ownerId === targetUserId) throw Errors.validation("Cannot block yourself");
  await db
    .insert(contacts)
    .values({ ownerId, contactUserId: targetUserId, state: "blocked", requestedBy: ownerId })
    .onConflictDoUpdate({
      target: [contacts.ownerId, contacts.contactUserId],
      set: { state: "blocked", updatedAt: new Date() },
    });
  // Drop the target's link to me.
  await db
    .delete(contacts)
    .where(and(eq(contacts.ownerId, targetUserId), eq(contacts.contactUserId, ownerId)));
}

export async function unblock(ownerId: string, targetUserId: string): Promise<void> {
  await db
    .delete(contacts)
    .where(and(eq(contacts.ownerId, ownerId), eq(contacts.contactUserId, targetUserId), eq(contacts.state, "blocked")));
}

export async function remove(ownerId: string, contactId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)))
    .limit(1);
  if (!row) throw Errors.notFound("Contact not found");
  await db.delete(contacts).where(eq(contacts.id, contactId));
  // Remove the reciprocal accepted/pending link too (but not a block the other set).
  await db
    .delete(contacts)
    .where(
      and(
        eq(contacts.ownerId, row.contactUserId),
        eq(contacts.contactUserId, ownerId),
        or(eq(contacts.state, "accepted"), eq(contacts.state, "pending")),
      ),
    );
}

async function selfUsername(id: string): Promise<string> {
  const [u] = await db.select({ username: users.username }).from(users).where(eq(users.id, id)).limit(1);
  return u?.username ?? "";
}

/** Users who have `userId` as an accepted contact — told when it comes online/offline. */
export async function contactOwnersOf(userId: string): Promise<string[]> {
  const rows = await db
    .select({ ownerId: contacts.ownerId })
    .from(contacts)
    .where(and(eq(contacts.contactUserId, userId), eq(contacts.state, "accepted")));
  return rows.map((r) => r.ownerId);
}

/** Are two users mutually accepted contacts? (authorization helper) */
export async function areContacts(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ state: contacts.state })
    .from(contacts)
    .where(and(eq(contacts.ownerId, a), eq(contacts.contactUserId, b)))
    .limit(1);
  return row?.state === "accepted";
}

/**
 * Can `caller` start a call with `callee`? Mirrors the messaging rule so you can
 * always call anyone you can message: accepted contacts, or a public user, as
 * long as neither has blocked the other. contacts_only / private users must be
 * accepted contacts.
 */
export async function canCall(caller: string, callee: string): Promise<boolean> {
  if (caller === callee) return false;

  // Blocked in either direction → no.
  const [blocked] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.state, "blocked"),
        or(
          and(eq(contacts.ownerId, caller), eq(contacts.contactUserId, callee)),
          and(eq(contacts.ownerId, callee), eq(contacts.contactUserId, caller)),
        ),
      ),
    )
    .limit(1);
  if (blocked) return false;

  if (await areContacts(caller, callee)) return true;

  // Otherwise allow only if the callee is publicly reachable.
  const [target] = await db
    .select({ privacy: users.privacy, status: users.status })
    .from(users)
    .where(eq(users.id, callee))
    .limit(1);
  return target?.status === "active" && target.privacy === "public";
}
