import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { appSettings, accessNetworks } from "../../db/schema.js";

/**
 * Network access lock for on-prem / offline deployments. An admin registers
 * approved network ranges (CIDRs); when the lock is ON, only clients whose IP
 * is in an approved range may use the app. Everything is IPv4-oriented (the LAN
 * use case); IPv6 clients are treated as not-matching unless a range covers them.
 */

const LOCK_KEY = "network_lock";

// ---- IP / CIDR helpers ----
export function normalizeIp(raw: string | undefined | null): string {
  if (!raw) return "";
  let ip = raw.trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4-mapped IPv6
  if (ip === "::1") ip = "127.0.0.1";
  // If it's a comma list (X-Forwarded-For), take the first (original client).
  if (ip.includes(",")) ip = ip.split(",")[0]!.trim();
  return ip;
}

function ipToLong(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1, 5).map(Number);
  if (p.some((n) => n > 255)) return null;
  return (((p[0]! << 24) | (p[1]! << 16) | (p[2]! << 8) | p[3]!) >>> 0);
}

/** Is `ip` inside `cidr` (e.g. "192.168.1.0/24" or a bare "192.168.1.5")? */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.trim().split("/");
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const ipL = ipToLong(ip);
  const rangeL = ipToLong(range ?? "");
  if (ipL === null || rangeL === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipL & mask) === (rangeL & mask);
}

// ---- Lock state ----
export async function isLockEnabled(): Promise<boolean> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, LOCK_KEY)).limit(1);
  return Boolean((row?.value as { enabled?: boolean })?.enabled);
}

export async function setLockEnabled(enabled: boolean): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: LOCK_KEY, value: { enabled } })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: { enabled }, updatedAt: new Date() } });
}

// ---- Approved networks ----
export async function listNetworks() {
  return db.select().from(accessNetworks).orderBy(accessNetworks.createdAt);
}

export async function addNetwork(cidr: string, label: string | null, createdBy: string) {
  const [row] = await db.insert(accessNetworks).values({ cidr: cidr.trim(), label, createdBy }).returning();
  return row!;
}

export async function removeNetwork(id: string): Promise<void> {
  await db.delete(accessNetworks).where(eq(accessNetworks.id, id));
}

/** Core check: is this client IP allowed right now? */
export async function isIpAllowed(clientIp: string): Promise<boolean> {
  if (!(await isLockEnabled())) return true; // lock off → everyone allowed
  const ip = normalizeIp(clientIp);
  // Always allow loopback so the host machine / admin isn't locked out.
  if (ip === "127.0.0.1" || ip === "") return true;
  const nets = await listNetworks();
  return nets.some((n) => ipInCidr(ip, n.cidr));
}

// ---- Partitioning (office isolation) ----
/** Accounts not on any approved office network belong to the shared "online" group. */
export const ONLINE_PARTITION = "online";

/**
 * Which partition does this client IP belong to right now? The id of the approved
 * office network its IP falls in, or "online" if it's not on any approved network
 * (e.g. mobile data, or before any networks are configured).
 */
export async function partitionForIp(clientIp: string): Promise<string> {
  const ip = normalizeIp(clientIp);
  if (!ip || ip === "127.0.0.1") return ONLINE_PARTITION; // host/admin machine
  const nets = await listNetworks();
  const match = nets.find((n) => ipInCidr(ip, n.cidr));
  return match ? match.id : ONLINE_PARTITION;
}
