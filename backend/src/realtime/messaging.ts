import type { Namespace, Socket } from "socket.io";
import {
  ClientEvents,
  ServerEvents,
  rtMessageSendSchema,
  rtMessageDeliveredSchema,
  rtMessageReadSchema,
  rtTypingSchema,
  type Ack,
} from "@nexa/shared";
import * as messagesService from "../modules/messages/messages.service.js";
import { memberIds } from "../modules/conversations/conversations.service.js";
import { consumeRateLimit } from "../middleware/rateLimit.js";
import { userRoom } from "./emitter.js";
import type { SocketData } from "./auth.js";
import { logger } from "../lib/logger.js";

export function registerMessaging(nsp: Namespace, socket: Socket): void {
  const { userId } = socket.data as SocketData;

  socket.on(
    ClientEvents.MessageSend,
    async (payload, ack?: (r: Ack) => void) => {
      const parsed = rtMessageSendSchema.safeParse(payload);
      if (!parsed.success) {
        return ack?.({ ok: false, error: { code: "VALIDATION", message: "invalid message" } });
      }
      const allowed = await consumeRateLimit("rt:msg", userId, 240, 60);
      if (!allowed) {
        return ack?.({ ok: false, error: { code: "RATE_LIMITED", message: "slow down", retryAfter: 60 } });
      }

      try {
        const { message, recipients } = await messagesService.persist({
          ...parsed.data,
          senderId: userId,
        });
        // Deliver to recipients (all their devices) — sender's other devices get it too.
        for (const r of [...recipients, userId]) {
          nsp.to(userRoom(r)).emit(ServerEvents.MessageNew, message);
        }
        ack?.({ ok: true, data: { id: message.id, serverCreatedAt: message.serverCreatedAt } });
      } catch (err) {
        logger.warn({ err }, "message:send failed");
        ack?.({ ok: false, error: { code: "FORBIDDEN", message: "cannot send to this conversation" } });
      }
    },
  );

  socket.on(ClientEvents.MessageDelivered, async (payload) => {
    const parsed = rtMessageDeliveredSchema.safeParse(payload);
    if (!parsed.success) return;
    await messagesService.markDelivered(parsed.data.messageId, userId).catch(() => {});
    // Notify the original sender's devices that their message was delivered.
    const meta = await messagesService.getMeta(parsed.data.messageId).catch(() => null);
    if (meta) {
      nsp.to(userRoom(meta.senderId)).emit(ServerEvents.MessageReceipt, {
        messageId: parsed.data.messageId,
        userId,
        delivered_at: new Date().toISOString(),
      });
    }
  });

  socket.on(ClientEvents.MessageRead, async (payload) => {
    const parsed = rtMessageReadSchema.safeParse(payload);
    if (!parsed.success) return;
    try {
      await messagesService.markRead(parsed.data.conversationId, userId, parsed.data.upToMessageId);
      const members = await memberIds(parsed.data.conversationId);
      for (const m of members) {
        nsp.to(userRoom(m)).emit(ServerEvents.MessageReceipt, {
          conversationId: parsed.data.conversationId,
          upToMessageId: parsed.data.upToMessageId,
          userId,
          read_at: new Date().toISOString(),
        });
      }
    } catch {
      /* not a member — ignore */
    }
  });

  const emitTyping = (active: boolean) => async (payload: unknown) => {
    const parsed = rtTypingSchema.safeParse(payload);
    if (!parsed.success) return;
    const members = await memberIds(parsed.data.conversationId).catch(() => []);
    for (const m of members) {
      if (m === userId) continue;
      nsp.to(userRoom(m)).emit(ServerEvents.Typing, {
        conversationId: parsed.data.conversationId,
        userId,
        active,
      });
    }
  };
  socket.on(ClientEvents.TypingStart, emitTyping(true));
  socket.on(ClientEvents.TypingStop, emitTyping(false));
}
