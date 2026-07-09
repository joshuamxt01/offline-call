import { createServer } from "node:http";
import { createApp } from "./app.js";
import { initRealtime } from "./realtime/io.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { sql } from "./config/db.js";
import { redis, pubClient, subClient } from "./config/redis.js";
import { purgeExpiredTokens } from "./modules/auth/auth.service.js";

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
