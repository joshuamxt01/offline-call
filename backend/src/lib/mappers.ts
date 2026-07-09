import type { UserRow, DeviceRow, MessageRow, CallRow } from "../db/schema.js";
import type {
  UserPublic,
  UserPrivate,
  DeviceDto,
  MessageDto,
  CallDto,
  Platform,
  UserRole,
  UserStatus,
  UserPrivacy,
  StatusKind,
  MessageType,
  CallType,
  CallTransport,
} from "@nexa/shared";

export function toUserPublic(u: UserRow): UserPublic {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: null, // resolved on demand via /media/:id/download-url
    bio: u.bio,
    statusKind: (u.statusKind as StatusKind) ?? "available",
    statusMessage: u.statusMessage ?? null,
  };
}

export function toUserPrivate(u: UserRow): UserPrivate {
  return {
    ...toUserPublic(u),
    email: u.email,
    role: u.role as UserRole,
    status: u.status as UserStatus,
    privacy: (u.privacy as UserPrivacy) ?? "public",
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toDeviceDto(d: DeviceRow): DeviceDto {
  return {
    id: d.id,
    deviceName: d.deviceName,
    platform: d.platform as Platform,
    verified: d.verified,
    lastActiveAt: d.lastActiveAt ? d.lastActiveAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

export function toMessageDto(m: MessageRow): MessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    type: m.type as MessageType,
    ciphertext: Buffer.from(m.ciphertext).toString("base64"),
    nonce: Buffer.from(m.nonce).toString("base64"),
    mediaObjectId: m.mediaObjectId,
    clientCreatedAt: m.clientCreatedAt.toISOString(),
    serverCreatedAt: m.serverCreatedAt.toISOString(),
    status: m.status as MessageDto["status"],
  };
}

export function toCallDto(c: CallRow): CallDto {
  return {
    id: c.id,
    conversationId: c.conversationId,
    callerId: c.callerId,
    type: c.type as CallType,
    transport: (c.transport as CallTransport) ?? null,
    status: c.status as CallDto["status"],
    startedAt: c.startedAt.toISOString(),
    answeredAt: c.answeredAt ? c.answeredAt.toISOString() : null,
    endedAt: c.endedAt ? c.endedAt.toISOString() : null,
    durationSeconds: c.durationSeconds,
  };
}
