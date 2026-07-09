/**
 * Applies the canonical schema (database/schema.sql) to $DATABASE_URL.
 * Idempotent (all DDL uses IF NOT EXISTS). Run: `npm run migrate`.
 *
 * We apply the readable canonical SQL rather than generated migrations so the
 * schema stays the single source of truth. For versioned production migrations,
 * `npm run db:generate` (drizzle-kit) can additionally emit diffs into
 * database/migrations.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "../../../database/schema.sql");

async function main() {
  const ddl = readFileSync(schemaPath, "utf8");
  const needsSsl = /sslmode=require|neon\.tech/.test(env.DATABASE_URL);
  const sql = postgres(env.DATABASE_URL, {
    max: 1,
    ssl: needsSsl ? "require" : undefined,
    onnotice: () => {},
  });

  logger.info(`Applying schema from ${schemaPath}`);
  await sql.unsafe(ddl);
  logger.info("✅ Schema applied");
  await sql.end();
}

main().catch((err) => {
  logger.error(err, "Migration failed");
  process.exit(1);
});
