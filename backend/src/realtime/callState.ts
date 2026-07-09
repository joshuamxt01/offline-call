import { redis } from "../config/redis.js";
import type { CallType, CallTransport } from "@nexa/shared";

/**
 * Ephemeral live call state in Redis. The durable ledger lives in Postgres
 * (calls table); this is the fast state machine coordinating signaling across
 * backend instances.
 *
 *   ringing → answered → connected → ended
 *            ↘ rejected / missed / failed
 */
export type CallLiveState = "ringing" | "answered" | "connected" | "ended";

const key = (callId: string) => `call:${callId}`;
const CALL_TTL = 2 * 60 * 60; // 2h

export async function createCallState(
  callId: string,
  data: { caller: string; callee: string; type: CallType },
): Promise<void> {
  await redis.hset(key(callId), {
    state: "ringing",
    caller: data.caller,
    callee: data.callee,
    type: data.type,
    startedAt: String(Date.now()),
  });
  await redis.expire(key(callId), CALL_TTL);
}

export async function setState(callId: string, state: CallLiveState): Promise<void> {
  await redis.hset(key(callId), "state", state);
}

export async function setTransport(callId: string, transport: CallTransport): Promise<void> {
  await redis.hset(key(callId), "transport", transport);
}

export async function getCallState(callId: string): Promise<Record<string, string> | null> {
  const data = await redis.hgetall(key(callId));
  return Object.keys(data).length ? data : null;
}

export async function clearCall(callId: string): Promise<void> {
  await redis.del(key(callId));
}
