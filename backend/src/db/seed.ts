/**
 * Dev seed — creates admin/alice/bob with real Argon2id password hashes,
 * makes alice+bob mutual contacts, and a demo approved network.
 * Password for all: "Password123!". Run: `npm run seed`.
 */
import { db, sql } from "../config/db.js";
import {
  users,
  contacts,
  networks,
  conversations,
  conversationMembers,
} from "./schema.js";
import { hashPassword } from "../lib/password.js";
import { logger } from "../lib/logger.js";
import { eq } from "drizzle-orm";

const ADMIN = "00000000-0000-0000-0000-000000000001";
const ALICE = "00000000-0000-0000-0000-000000000002";
const BOB = "00000000-0000-0000-0000-000000000003";

async function main() {
  const passwordHash = await hashPassword("Password123!");

  await db
    .insert(users)
    .values([
      { id: ADMIN, username: "admin", email: "admin@nexa.local", passwordHash, displayName: "Nexa Admin", role: "admin" },
      { id: ALICE, username: "alice", email: "alice@nexa.local", passwordHash, displayName: "Alice", role: "user" },
      { id: BOB, username: "bob", email: "bob@nexa.local", passwordHash, displayName: "Bob", role: "user" },
    ])
    .onConflictDoNothing();

  await db
    .insert(contacts)
    .values([
      { ownerId: ALICE, contactUserId: BOB, state: "accepted" },
      { ownerId: BOB, contactUserId: ALICE, state: "accepted" },
    ])
    .onConflictDoNothing();

  // A direct conversation between alice and bob
  const existing = await db.select().from(conversations).where(eq(conversations.createdBy, ALICE));
  if (existing.length === 0) {
    const [conv] = await db
      .insert(conversations)
      .values({ type: "direct", createdBy: ALICE })
      .returning();
    if (conv) {
      await db.insert(conversationMembers).values([
        { conversationId: conv.id, userId: ALICE },
        { conversationId: conv.id, userId: BOB },
      ]).onConflictDoNothing();
    }
  }

  await db
    .insert(networks)
    .values({
      ownerId: ALICE,
      ssidHash: "sha256:demo-ssid-hash",
      localIdentifier: "nexa-demo-lan",
      label: "Demo LAN",
      approved: true,
      permissions: { allowDiscovery: true, autoAcceptCalls: false },
    })
    .onConflictDoNothing();

  logger.info("✅ Seed complete — login admin@nexa.local / Password123!");
  await sql.end();
}

main().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
