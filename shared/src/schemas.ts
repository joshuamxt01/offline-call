import { z } from "zod";

/** Zod schemas — validated on both REST (backend) and forms (web). */

export const platformSchema = z.enum(["android", "web"]);
export const callTypeSchema = z.enum(["voice", "video"]);
export const messageTypeSchema = z.enum(["text", "voice", "video", "image", "file", "system"]);
export const mediaKindSchema = z.enum(["avatar", "voice_note", "video_note", "image", "file"]);

const b64 = z.string().min(1).max(4096);

export const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.]+$/, "letters, numbers, _ and . only"),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  deviceName: z.string().max(120).optional(),
  platform: platformSchema,
  identityPub: b64.optional(),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(3).max(254),
  password: z.string().min(1).max(200),
  deviceName: z.string().max(120).optional(),
  platform: platformSchema,
  identityPub: b64.optional(),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const verifyDeviceSchema = z.object({ code: z.string().min(4).max(12) });

export const updateProfileSchema = z.object({
  displayName: z.string().max(80).optional(),
  bio: z.string().max(300).optional(),
  avatarObjectId: z.string().uuid().optional(),
  privacy: z.enum(["public", "private", "contacts_only"]).optional(),
  statusKind: z.enum(["available", "busy", "in_meeting", "at_work", "away", "dnd", "custom"]).optional(),
  statusMessage: z.string().max(120).nullish(),
});

export const userSearchSchema = z.object({
  q: z.string().min(2).max(32),
});

export const createContactSchema = z.object({
  contactUserId: z.string().uuid(),
});

export const updateContactSchema = z.object({
  state: z.enum(["accepted", "blocked"]).optional(),
  alias: z.string().max(80).optional(),
  favorite: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const createConversationSchema = z.object({
  participantId: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  id: z.string().min(20).max(30), // ULID
  type: messageTypeSchema,
  ciphertext: b64,
  nonce: b64,
  mediaObjectId: z.string().uuid().nullish(),
  clientCreatedAt: z.string().datetime(),
});

export const syncPushSchema = z.object({
  messages: z
    .array(sendMessageSchema.extend({ conversationId: z.string().uuid() }))
    .max(200),
});

export const uploadUrlSchema = z.object({
  kind: mediaKindSchema,
  contentType: z.string().max(120),
  sizeBytes: z.number().int().positive().max(200 * 1024 * 1024),
  durationMs: z.number().int().positive().optional(),
});

export const createNetworkSchema = z.object({
  ssidHash: z.string().max(128),
  bssidHash: z.string().max(128).optional(),
  localIdentifier: z.string().max(128),
  label: z.string().max(80),
  permissions: z.record(z.unknown()).optional(),
});

export const prekeyReplenishSchema = z.object({
  oneTimePrekeys: z.array(b64).max(100),
});

/** ---- Realtime event schemas ---- */
export const rtMessageSendSchema = sendMessageSchema.extend({
  conversationId: z.string().uuid(),
});
export const rtMessageDeliveredSchema = z.object({ messageId: z.string() });
export const rtMessageReadSchema = z.object({
  conversationId: z.string().uuid(),
  upToMessageId: z.string(),
});
export const rtTypingSchema = z.object({ conversationId: z.string().uuid() });
export const rtCallInviteSchema = z.object({
  callId: z.string().uuid(),
  calleeId: z.string().uuid(),
  type: callTypeSchema,
});
export const rtCallRefSchema = z.object({ callId: z.string().uuid() });
export const rtCallRejectSchema = z.object({
  callId: z.string().uuid(),
  reason: z.string().max(40).optional(),
});
export const rtSignalSchema = z.object({
  callId: z.string().uuid(),
  sdp: z.string().max(200_000).optional(),
  candidate: z.unknown().optional(),
});
export const rtPresenceSubscribeSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
