/** Socket.IO event names — one canonical constant per event. */

export const RT_NAMESPACE = "/rt";

/** Client → Server */
export const ClientEvents = {
  PresenceHeartbeat: "presence:heartbeat",
  PresenceSubscribe: "presence:subscribe",

  MessageSend: "message:send",
  MessageDelivered: "message:delivered",
  MessageRead: "message:read",
  ReactionSet: "reaction:set",
  TypingStart: "typing:start",
  TypingStop: "typing:stop",

  CallInvite: "call:invite",
  CallAnswer: "call:answer",
  CallReject: "call:reject",
  CallEnd: "call:end",
  SignalOffer: "signal:offer",
  SignalAnswer: "signal:answer",
  SignalIce: "signal:ice",
} as const;

/** Server → Client */
export const ServerEvents = {
  PresenceUpdate: "presence:update",

  MessageNew: "message:new",
  MessageReceipt: "message:receipt",
  ReactionUpdate: "reaction:update",
  Typing: "typing",

  CallIncoming: "call:incoming",
  CallAnswered: "call:answered",
  CallRejected: "call:rejected",
  CallCancelled: "call:cancelled",
  CallEnded: "call:ended",
  SignalOffer: "signal:offer",
  SignalAnswer: "signal:answer",
  SignalIce: "signal:ice",

  NotificationNew: "notification:new",

  Error: "error",
} as const;

export type ClientEventName = (typeof ClientEvents)[keyof typeof ClientEvents];
export type ServerEventName = (typeof ServerEvents)[keyof typeof ServerEvents];

/** Standard ack envelope for C→S events with a callback. */
export interface Ack<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; retryAfter?: number };
}
