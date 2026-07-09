// Wipes ALL user accounts + their data (devices, contacts, messages, calls,
// media metadata, notifications). Keeps schema, network-lock settings, and audit.
// Run via clear-accounts.bat (which adds a confirmation prompt).
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { config } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../backend/.env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found in backend/.env");
  process.exit(1);
}

// Connect with retries — the cloud DB (Neon) can drop a first connection or be
// briefly unreachable on a flaky network.
async function connect(tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require", onnotice: () => {}, connect_timeout: 30 });
      await sql`select 1`;
      return sql;
    } catch (e) {
      console.log(`  connection attempt ${i}/${tries} failed (${e.code || e.message})`);
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

let sql;
try {
  sql = await connect();
  const [{ count }] = await sql`select count(*)::int as count from users`;
  console.log(`Deleting ${count} account(s) and everything they own...`);
  // Deleting users cascades to devices, device_keys, refresh_tokens, contacts,
  // conversation_members, messages, message_receipts, calls, call_participants,
  // media_objects and notifications. Conversations (created_by = SET NULL) are
  // left orphaned, so remove them too.
  await sql`delete from users`;
  await sql`delete from conversations`;
  console.log("");
  console.log("✅ All accounts and their data are wiped.");
  console.log("   Those emails/usernames are now free to register fresh.");
  console.log("   (Network-lock settings and audit log were kept.)");
} catch (e) {
  console.error("❌ Failed:", e.message || e);
  process.exitCode = 1;
} finally {
  await sql?.end();
}
