// Promote a user to admin (or demote back to user).
//   node make-admin.mjs <username>          -> makes them admin
//   node make-admin.mjs <username> user     -> demotes back to a normal user
// The role is baked into the login token, so the user must LOG OUT and LOG IN
// again after this for the Admin panel to appear.
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

const username = process.argv[2];
const role = (process.argv[3] || "admin").toLowerCase();
if (!username) {
  console.error('Usage: node make-admin.mjs <username> [admin|user]');
  process.exit(1);
}
if (role !== "admin" && role !== "user") {
  console.error('Role must be "admin" or "user".');
  process.exit(1);
}

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
  // Case-insensitive match so "MXT", "mxt", "Mxt" all work.
  const rows = await sql`
    update users set role = ${role}
    where lower(username) = lower(${username})
    returning username, role`;
  if (rows.length === 0) {
    console.error(`\n❌ No account with username "${username}" was found.`);
    const all = await sql`select username, role from users order by created_at`;
    console.log("   Existing accounts:");
    for (const u of all) console.log(`     - ${u.username} (${u.role})`);
    process.exitCode = 1;
  } else {
    console.log(`\n✅ "${rows[0].username}" is now role: ${rows[0].role}.`);
    console.log("   IMPORTANT: log OUT and log back IN on that account so the");
    console.log("   new role takes effect, then the Admin panel will appear.");
  }
} catch (e) {
  console.error("❌ Failed:", e.message || e);
  process.exitCode = 1;
} finally {
  await sql?.end();
}
