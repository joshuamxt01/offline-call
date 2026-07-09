import type { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { Errors } from "../lib/http-error.js";

/**
 * Standalone rate-limit check (used by Socket.IO handlers, which don't have the
 * Express middleware chain). Returns true if the action is allowed.
 */
export async function consumeRateLimit(
  scope: string,
  id: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const key = `ratelimit:${scope}:${id}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return count <= max;
  } catch {
    return true; // fail-open
  }
}

interface RateLimitOptions {
  scope: string;
  max?: number;
  windowSec?: number;
  /** How to identify the caller. Default: authed userId, else IP. */
  keyBy?: (req: Request) => string;
}

/**
 * Fixed-window rate limiter backed by Redis (INCR + EXPIRE). Atomic-enough for
 * abuse prevention; swap for a sliding window / token bucket if needed.
 */
export function rateLimit(opts: RateLimitOptions) {
  const max = opts.max ?? env.RATE_LIMIT_MAX;
  const windowSec = opts.windowSec ?? env.RATE_LIMIT_WINDOW;

  return async (req: Request, res: Response, next: NextFunction) => {
    const id = opts.keyBy?.(req) ?? req.auth?.userId ?? req.ip ?? "anon";
    const key = `ratelimit:${opts.scope}:${id}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      if (count > max) {
        const ttl = await redis.ttl(key);
        res.setHeader("X-RateLimit-Limit", String(max));
        res.setHeader("X-RateLimit-Remaining", "0");
        return next(Errors.rateLimited(ttl > 0 ? ttl : windowSec));
      }
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));
      next();
    } catch {
      // Fail-open on Redis errors — never block legitimate traffic on infra hiccup.
      next();
    }
  };
}
