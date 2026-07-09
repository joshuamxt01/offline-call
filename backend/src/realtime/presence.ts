import type { Namespace, Socket } from "socket.io";
import { ClientEvents, ServerEvents } from "@nexa/shared";
import { rtPresenceSubscribeSchema } from "@nexa/shared";
import { markOnline, heartbeat, markOffline, presenceFor } from "../lib/presence.js";
import { contactOwnersOf } from "../modules/contacts/contacts.service.js";
import { userRoom } from "./emitter.js";
import type { SocketData } from "./auth.js";
import { logger } from "../lib/logger.js";

export function registerPresence(nsp: Namespace, socket: Socket): void {
  const { userId, deviceId } = socket.data as SocketData;

  // Join personal rooms so events can target a user or a specific device.
  socket.join(userRoom(userId));
  socket.join(`device:${deviceId}`);

  void onConnect();

  async function onConnect() {
    await markOnline(userId, deviceId);
    // Tell this user's contacts they're online.
    const owners = await contactOwnersOf(userId);
    for (const owner of owners) {
      nsp.to(userRoom(owner)).emit(ServerEvents.PresenceUpdate, {
        userId,
        online: true,
        lastSeen: new Date().toISOString(),
      });
    }
  }

  socket.on(ClientEvents.PresenceHeartbeat, async () => {
    await heartbeat(userId, deviceId).catch((err) => logger.warn({ err }, "heartbeat failed"));
  });

  socket.on(ClientEvents.PresenceSubscribe, async (payload, ack?: (r: unknown) => void) => {
    const parsed = rtPresenceSubscribeSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false, error: { code: "VALIDATION", message: "bad payload" } });
    const map = await presenceFor(parsed.data.userIds);
    ack?.({ ok: true, data: Array.from(map.values()) });
  });

  socket.on("disconnect", async () => {
    const nowOffline = await markOffline(userId, deviceId).catch(() => false);
    if (nowOffline) {
      const owners = await contactOwnersOf(userId);
      for (const owner of owners) {
        nsp.to(userRoom(owner)).emit(ServerEvents.PresenceUpdate, {
          userId,
          online: false,
          lastSeen: new Date().toISOString(),
        });
      }
    }
  });
}
