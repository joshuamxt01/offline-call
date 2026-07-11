/** Wire DTOs shared across clients and server. */

export type Platform = "android" | "web";
export type CallType = "voice" | "video";
export type CallTransport = "p2p" | "lan" | "turn";
export type MessageType = "text" | "voice" | "video" | "image" | "file" | "system";
export type ContactState = "pending" | "accepted" | "blocked";
export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "deleted";
export type MediaKind = "avatar" | "voice_note" | "video_note" | "image" | "file";

/** Who can find/contact a user. Expandable (contacts_only added; more later). */
export type UserPrivacy = "public" | "private" | "contacts_only";

/** Availability the user chooses. */
export type StatusKind =
  | "available"
  | "busy"
  | "in_meeting"
  | "at_work"
  | "away"
  | "dnd"
  | "custom";

/** Derived presence surfaced to others. */
export type PresenceState = "online" | "local" | "busy" | "in_call" | "away" | "offline";

/** Client connectivity mode for the status badge. */
export type ConnectivityMode = "online" | "local" | "offline";

export interface UserPublic {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  /** Chosen availability, shown when privacy allows. Optional (additive). */
  statusKind?: StatusKind;
  statusMessage?: string | null;
}

export interface UserPrivate extends UserPublic {
  email: string;
  role: UserRole;
  status: UserStatus;
  privacy: UserPrivacy;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface DeviceDto {
  id: string;
  deviceName: string | null;
  platform: Platform;
  verified: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: UserPrivate;
  device: DeviceDto;
  accessToken: string;
  refreshToken: string;
}

export interface ContactDto {
  id: string;
  user: UserPublic;
  alias: string | null;
  state: ContactState;
  /** For pending rows: true if the other user sent the request TO me (I accept/reject);
   *  false if I sent it (I can cancel). */
  incoming: boolean;
  favorite: boolean;
  pinned: boolean;
  online: boolean;
  presence: PresenceState;
  lastSeen: string | null;
}

export interface NotificationDto {
  id: string;
  type: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface PublicKeyBundle {
  userId: string;
  deviceId: string;
  identityPub: string; // base64
  signedPrekey: string; // base64
  signedPrekeySig: string; // base64
  oneTimePrekey: string | null; // base64, consumed on fetch
  algo: string;
}

export interface MessageDto {
  id: string; // ULID (client-authored)
  conversationId: string;
  senderId: string;
  type: MessageType;
  ciphertext: string; // base64 (server cannot read)
  nonce: string; // base64
  mediaObjectId: string | null;
  clientCreatedAt: string;
  serverCreatedAt: string;
  status: "sent" | "delivered" | "read";
}

export interface CallDto {
  id: string;
  conversationId: string | null;
  callerId: string;
  type: CallType;
  transport: CallTransport | null;
  status: "ringing" | "answered" | "rejected" | "missed" | "ended" | "failed";
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}

export interface PresenceUpdate {
  userId: string;
  online: boolean;
  lastSeen: string | null;
}

/** ---- Realtime payloads ---- */
export interface MessageSendPayload {
  id: string;
  conversationId: string;
  type: MessageType;
  ciphertext: string;
  nonce: string;
  mediaObjectId?: string | null;
  clientCreatedAt: string;
}

export interface CallInvitePayload {
  callId: string;
  calleeId: string;
  type: CallType;
}

export interface SignalPayload {
  callId: string;
  sdp?: string;
  candidate?: unknown;
}
