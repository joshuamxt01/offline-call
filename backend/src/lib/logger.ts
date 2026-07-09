import { pino } from "pino";
import { env, isProd } from "../config/env.js";

export const logger = pino({
  level: isProd ? "info" : "debug",
  transport: isProd
    ? undefined
    : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
  base: { env: env.NODE_ENV },
});
