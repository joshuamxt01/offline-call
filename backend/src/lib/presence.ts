import { redis } from "../config/redis.js";
import type { PresenceUpdate } from "@nexa/shared";

/**
 * Presence in Redis (ephemeral, TTL-based). Source of truth for "who is online"
 * across all backend instances. Losing Redis degrades presence only — never data.
 */
const HEARTBEAT_TTL = 45; // seconds; client beats every ~20-30s
const userKey = (userId: string) => `presence:user:${userId}`;
const deviceKey = (deviceId: string) => `heartbeat:device:${deviceId}`;

export async function markOnline(userId: string, deviceId: string): Promise<void> {
  const now = Date.now();
  await Promise.all([
    redis.hset(userKey(userId), deviceId, now),
    redis.expire(userKey(userId), HEARTBEAT_TTL * 3),
    redis.set(deviceKey(deviceId), "1", "EX", HEARTBEAT_TTL),
    redis.zadd("presence:online", now, userId),
  ]);
}

export async function heartbeat(userId: string, deviceId: string): Promise<void> {
  const now = Date.now();
  await Promise.all([
    redis.hset(userKey(userId), deviceId, now),
    redis.set(deviceKey(deviceId), "1", "EX", HEARTBEAT_TTL),
    redis.zadd("presence:online", now, userId),
  ]);
}

export async function markOffline(userId: string, deviceId: string): Promise<boolean> {
  await redis.hdel(userKey(userId), deviceId);
  await redis.del(deviceKey(deviceId));
  const remaining = await redis.hlen(userKey(userId));
  if (remaining === 0) {
    await redis.zrem("presence:online", userId);
    return true; // user is now fully offline
  }
  return false;
}

export async function isOnline(userId: string): Promise<boolean> {
  const devices = await redis.hgetall(userKey(userId));
  for (const deviceId of Object.keys(devices)) {
    if (await redis.exists(deviceKey(deviceId))) return true;
  }
  return false;
}

export async function presenceFor(userIds: string[]): Promise<Map<string, PresenceUpdate>> {
  const result = new Map<string, PresenceUpdate>();
  await Promise.all(
    userIds.map(async (userId) => {
      const online = await isOnline(userId);
      const scores = await redis.hvals(userKey(userId));
      const lastBeat = scores.length ? Math.max(...scores.map(Number)) : null;
      result.set(userId, {
        userId,
        online,
        lastSeen: lastBeat ? new Date(lastBeat).toISOString() : null,
      });
    }),
  );
  return result;
}
