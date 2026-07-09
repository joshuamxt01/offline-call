import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { apiRouter } from "./routes.js";
import { notFound, errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // behind Render's proxy — correct req.ip for rate limiting
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  // Liveness/readiness for Render + uptime checks.
  app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

  app.use("/api/v1", apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
