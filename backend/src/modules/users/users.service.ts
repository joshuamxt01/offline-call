import { and, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, contacts } from "../../db/schema.js";
import { Errors } from "../../lib/http-error.js";
import { toUserPublic, toUserPrivate } from "../../lib/mappers.js";
import { isLockEnabled, ONLINE_PARTITION } from "../access/access.service.js";
import type { UserPublic } from "@nexa/shared";

/**
 * Two users are in the same "partition" (office Wi-Fi or the shared online group)
 * so they may see/contact each other. Only enforced while the network lock is on;
 * admins are never partitioned. Returns true (visible) when partitioning is off.
 */
async function samePartition(
  self: { role: string; networkPartition: string | null } | undefined,
  otherPartition: string | null,
): Promise<boolean> {
  if (!self || self.role === "admin") return true;
  if (!(await isLockEnabled())) return true;
  return (self.networkPartition ?? ONLINE_PARTITION) === (otherPartition ?? ONLINE_PARTITION);
}

/** User ids in a block relationship with `selfId` (either direction). */
async function blockedUserIds(selfId: string): Promise<Set<string>> {
  const rows = await db
    .select({ ownerId: contacts.ownerId, contactUserId: contacts.contactUserId })
    .from(contacts)
    .where(
      and(
        eq(contacts.state, "blocked"),
        or(eq(contacts.ownerId, selfId), eq(contacts.contactUserId, selfId)),
      ),
    );
  const set = new Set<string>();
  for (const r of rows) set.add(r.ownerId === selfId ? r.contactUserId : r.ownerId);
  return set;
}

/**
 * Search users by username, respecting privacy:
 *  - `private` users never appear in search.
 *  - blocked users (either direction) are excluded.
 *  - `public` and `contacts_only` are findable (interaction is still gated by
 *    the contact workflow for contacts_only).
 */
export async function search(query: string, selfId: string): Promise<UserPublic[]> {
  const [self] = await db
    .select({ role: users.role, networkPartition: users.networkPartition })
    .from(users)
    .where(eq(users.id, selfId))
    .limit(1);

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        ilike(users.username, `%${query}%`),
        ne(users.id, selfId),
        eq(users.status, "active"),
        ne(users.privacy, "private"),
      ),
    )
    .limit(60);

  const blocked = await blockedUserIds(selfId);
  const visible: UserPublic[] = [];
  for (const r of rows) {
    if (blocked.has(r.id)) continue;
    // Office partitioning: only surface users in the same partition.
    if (!(await samePartition(self, r.networkPartition))) continue;
    visible.push(toUserPublic(r));
    if (visible.length >= 20) break;
  }
  return visible;
}

export async function getPublic(id: string, selfId: string): Promise<UserPublic> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row || row.status === "deleted") throw Errors.notFound("User not found");

  // Office partitioning: users in another partition are invisible to each other.
  if (id !== selfId) {
    const [self] = await db
      .select({ role: users.role, networkPartition: users.networkPartition })
      .from(users)
      .where(eq(users.id, selfId))
      .limit(1);
    if (!(await samePartition(self, row.networkPartition))) throw Errors.notFound("User not found");
  }

  // Private profiles are only visible to accepted contacts (or self).
  if (row.privacy === "private" && id !== selfId) {
    const [rel] = await db
      .select({ state: contacts.state })
      .from(contacts)
      .where(and(eq(contacts.ownerId, selfId), eq(contacts.contactUserId, id)))
      .limit(1);
    if (rel?.state !== "accepted") throw Errors.notFound("User not found");
  }
  return toUserPublic(row);
}

export async function updateProfile(
  id: string,
  patch: {
    displayName?: string;
    bio?: string;
    avatarObjectId?: string;
    privacy?: "public" | "private" | "contacts_only";
    statusKind?: string;
    statusMessage?: string | null;
  },
) {
  const [row] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (!row) throw Errors.notFound("User not found");
  return toUserPrivate(row);
}
