import type { Namespace, Socket } from "socket.io";
import {
  ClientEvents,
  ServerEvents,
  rtCallInviteSchema,
  rtCallRefSchema,
  rtCallRejectSchema,
  rtSignalSchema,
  type Ack,
} from "@nexa/shared";
import * as callsService from "../modules/calls/calls.service.js";
import * as callState from "./callState.js";
import { canCall } from "../modules/contacts/contacts.service.js";
import { consumeRateLimit } from "../middleware/rateLimit.js";
import { userRoom } from "./emitter.js";
import type { SocketData } from "./auth.js";
import { logger } from "../lib/logger.js";

const RING_TIMEOUT_MS = 45_000;
/** Per-instance ring timers. The instance that created the invite owns the timer. */
const ringTimers = new Map<string, NodeJS.Timeout>();

export function registerSignaling(nsp: Namespace, socket: Socket): void {
  const { userId } = socket.data as SocketData;

  // --- Call invite (online path) ------------------------------------------
  socket.on(ClientEvents.CallInvite, async (payload, ack?: (r: Ack) => void) => {
    const parsed = rtCallInviteSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false, error: { code: "VALIDATION", message: "bad invite" } });

    const allowed = await consumeRateLimit("rt:call", userId, 30, 60);
    if (!allowed) return ack?.({ ok: false, error: { code: "RATE_LIMITED", message: "too many calls", retryAfter: 60 } });

    const { callId, calleeId, type } = parsed.data;
    if (!(await canCall(userId, calleeId))) {
      return ack?.({
        ok: false,
        error: { code: "FORBIDDEN", message: "You can only call your contacts or public users" },
      });
    }

    try {
      await callsService.createCall({ callId, callerId: userId, calleeId, type });
      await callState.createCallState(callId, { caller: userId, callee: calleeId, type });

      nsp.to(userRoom(calleeId)).emit(ServerEvents.CallIncoming, { callId, callerId: userId, type });

      // Ring timeout → mark missed if still ringing.
      const timer = setTimeout(async () => {
        const state = await callState.getCallState(callId);
        if (state?.state === "ringing") {
          await callsService.markEnded(callId, "timeout");
          await callState.clearCall(callId);
          nsp.to(userRoom(userId)).emit(ServerEvents.CallEnded, { callId, reason: "timeout", duration: 0 });
          nsp.to(userRoom(calleeId)).emit(ServerEvents.CallCancelled, { callId, reason: "timeout" });
        }
        ringTimers.delete(callId);
      }, RING_TIMEOUT_MS);
      ringTimers.set(callId, timer);

      ack?.({ ok: true, data: { callId } });
    } catch (err) {
      logger.warn({ err }, "call:invite failed");
      ack?.({ ok: false, error: { code: "INTERNAL", message: "could not start call" } });
    }
  });

  // --- Answer --------------------------------------------------------------
  socket.on(ClientEvents.CallAnswer, async (payload, ack?: (r: Ack) => void) => {
    const parsed = rtCallRefSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false, error: { code: "VALIDATION", message: "bad ref" } });
    const { callId } = parsed.data;
    if (!(await callsService.isParticipant(callId, userId))) {
      return ack?.({ ok: false, error: { code: "FORBIDDEN", message: "not a participant" } });
    }
    clearRing(callId);
    await callState.setState(callId, "answered");
    await callsService.markAnswered(callId);

    const state = await callState.getCallState(callId);
    if (state?.caller) {
      nsp.to(userRoom(state.caller)).emit(ServerEvents.CallAnswered, { callId, byDeviceId: socket.data.deviceId });
      // Tell the callee's *other* devices to stop ringing — socket.to() excludes
      // the device that just answered, so it does NOT cancel its own live call.
      socket.to(userRoom(userId)).emit(ServerEvents.CallCancelled, { callId, reason: "answered_elsewhere" });
    }
    ack?.({ ok: true });
  });

  // --- Reject --------------------------------------------------------------
  socket.on(ClientEvents.CallReject, async (payload, ack?: (r: Ack) => void) => {
    const parsed = rtCallRejectSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false });
    const { callId } = parsed.data;
    if (!(await callsService.isParticipant(callId, userId))) return ack?.({ ok: false });
    clearRing(callId);
    await callsService.markRejected(callId);
    await callState.clearCall(callId);
    const other = await callsService.counterpart(callId, userId);
    if (other) nsp.to(userRoom(other)).emit(ServerEvents.CallRejected, { callId });
    ack?.({ ok: true });
  });

  // --- End -----------------------------------------------------------------
  socket.on(ClientEvents.CallEnd, async (payload, ack?: (r: Ack) => void) => {
    const parsed = rtCallRefSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false });
    const { callId } = parsed.data;
    if (!(await callsService.isParticipant(callId, userId))) return ack?.({ ok: false });
    clearRing(callId);
    const call = await callsService.markEnded(callId, "hangup");
    await callState.clearCall(callId);
    const other = await callsService.counterpart(callId, userId);
    if (other) {
      nsp.to(userRoom(other)).emit(ServerEvents.CallEnded, {
        callId,
        reason: "hangup",
        duration: call?.durationSeconds ?? 0,
      });
    }
    ack?.({ ok: true });
  });

  // --- SDP / ICE relay (server never touches media, only these signals) ----
  const relay = (outEvent: string) => async (payload: unknown) => {
    const parsed = rtSignalSchema.safeParse(payload);
    if (!parsed.success) return;
    const { callId } = parsed.data;
    if (!(await callsService.isParticipant(callId, userId))) return;
    const other = await callsService.counterpart(callId, userId);
    if (other) nsp.to(userRoom(other)).emit(outEvent, { ...parsed.data, from: userId });
  };
  socket.on(ClientEvents.SignalOffer, relay(ServerEvents.SignalOffer));
  socket.on(ClientEvents.SignalAnswer, relay(ServerEvents.SignalAnswer));
  socket.on(ClientEvents.SignalIce, relay(ServerEvents.SignalIce));
}

function clearRing(callId: string): void {
  const t = ringTimers.get(callId);
  if (t) {
    clearTimeout(t);
    ringTimers.delete(callId);
  }
}
