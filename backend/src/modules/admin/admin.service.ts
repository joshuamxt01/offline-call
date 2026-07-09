import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import {
  users,
  devices,
  networks,
  calls,
  messages,
  auditLog,
  accessNetworks,
} from "../../db/schema.js";
import { redis } from "../../config/redis.js";
import { Errors } from "../../lib/http-error.js";
import { toUserPrivate, toDeviceDto, toCallDto } from "../../lib/mappers.js";

/** Map of approved-network id → friendly label, for resolving account partitions. */
async function partitionLabelMap(): Promise<Map<string, string>> {
  const nets = await db.select().from(accessNetworks);
  return new Map(nets.map((n) => [n.id, (n.label?.trim() || n.cidr)]));
}

/** Friendly label for a stored partition ("online" or an approved-network id). */
function labelForPartition(map: Map<string, string>, p: string | null): string {
  return !p || p === "online" ? "Online" : (map.get(p) ?? "Office network");
}

export async function listUsers(q?: string, status?: string) {
  const where = [];
  if (q) where.push(ilike(users.username, `%${q}%`));
  if (status) where.push(eq(users.status, status));
  const rows = await db
    .select()
    .from(users)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200);

  const labels = await partitionLabelMap();
  return rows.map((row) => ({
    ...toUserPrivate(row),
    networkPartition: row.networkPartition ?? "online",
    networkLabel: labelForPartition(labels, row.networkPartition),
  }));
}

export async function updateUser(id: string, patch: { status?: string; role?: string }) {
  const [row] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (!row) throw Errors.notFound("User not found");
  return toUserPrivate(row);
}

export async function listDevices() {
  const rows = await db
    .select({ device: devices, ownerUsername: users.username, partition: users.networkPartition })
    .from(devices)
    .leftJoin(users, eq(devices.userId, users.id))
    .orderBy(desc(devices.createdAt))
    .limit(500);

  const labels = await partitionLabelMap();
  return rows.map((r) => ({
    ...toDeviceDto(r.device),
    ownerUsername: r.ownerUsername ?? null,
    networkLabel: labelForPartition(labels, r.partition),
  }));
}

export async function listNetworks() {
  return db.select().from(networks).orderBy(desc(networks.createdAt)).limit(500);
}

export async function callLog(before?: string, limit = 100) {
  const rows = await db
    .select()
    .from(calls)
    .where(before ? sql`${calls.startedAt} < ${new Date(before)}` : undefined)
    .orderBy(desc(calls.startedAt))
    .limit(Math.min(limit, 200));
  return rows.map(toCallDto);
}

export async function audit(limit = 100) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(Math.min(limit, 500));
}

export async function stats() {
  const count = async (table: PgTable) => {
    const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(table);
    return row?.c ?? 0;
  };

  const [userCount, deviceCount, messageCount, callCount] = await Promise.all([
    count(users),
    count(devices),
    count(messages),
    count(calls),
  ]);

  // Online users from Redis presence index (last 60s).
  const cutoff = Date.now() - 60_000;
  const onlineUsers = await redis.zcount("presence:online", cutoff, "+inf");
  const activeCalls = (await redis.keys("call:*")).filter((k) => !k.includes(":invite:")).length;

  return {
    users: userCount,
    devices: deviceCount,
    messages: messageCount,
    calls: callCount,
    onlineUsers,
    activeCalls,
    timestamp: new Date().toISOString(),
  };
}
