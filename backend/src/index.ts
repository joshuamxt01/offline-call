import { createServer } from "node:http";
import { createApp } from "./app.js";
import { initRealtime } from "./realtime/io.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { sql } from "./config/db.js";
import { redis, pubClient, subClient } from "./config/redis.js";
import { purgeExpiredTokens } from "./modules/auth/auth.service.js";

// Idempotent schema-ensure (the deploy has no migration step). Safe to run every
// boot — only creates/alters if missing. Never crash the server on failure.
async function ensureSchema() {
  try {
    await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to text`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_privacy text NOT NULL DEFAULT 'public'`;
    await sql`CREATE TABLE IF NOT EXISTS message_reactions (
      message_id text NOT NULL,
      user_id uuid NOT NULL,
      emoji text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (message_id, user_id, emoji)
    )`;
    logger.info("schema ensured (reply_to, message_reactions)");
  } catch (err) {
    logger.error({ err }, "ensureSchema failed (continuing)");
  }
}
await ensureSchema();

const app = createApp();
const httpServer = createServer(app);
const io = initRealtime(httpServer);

// Periodic housekeeping — purge expired refresh tokens hourly.
const houskeeping = setInterval(() => {
  purgeExpiredTokens().catch((err) => logger.warn({ err }, "token purge failed"));
}, 60 * 60 * 1000);

httpServer.listen(env.PORT, () => {
  logger.info(`🚀 Nexa backend listening on :${env.PORT} (${env.NODE_ENV})`);
});

// --- Graceful shutdown -------------------------------------------------------
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down`);
  clearInterval(houskeeping);

  const timeout = setTimeout(() => {
    logger.error("Forced shutdown");
    process.exit(1);
  }, 10_000);

  try {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await Promise.allSettled([sql.end({ timeout: 5 }), redis.quit(), pubClient.quit(), subClient.quit()]);
    clearTimeout(timeout);
    logger.info("Clean shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ reason }, "unhandledRejection"));
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  void shutdown("uncaughtException");
});
