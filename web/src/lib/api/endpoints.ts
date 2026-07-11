"use client";
import { api } from "./client";
import type {
  AuthResult,
  UserPublic,
  UserPrivate,
  ContactDto,
  MessageDto,
  CallDto,
  DeviceDto,
  PublicKeyBundle,
  TurnCredentials,
} from "@nexa/shared";

// ---- Auth ----
export const authApi = {
  register: (body: {
    username: string;
    email: string;
    password: string;
    platform: "web";
    identityPub?: string;
    deviceName?: string;
  }) => api<AuthResult & { devVerifyCode?: string }>("/auth/register", { method: "POST", body, auth: false }),

  login: (body: {
    emailOrUsername: string;
    password: string;
    platform: "web";
    identityPub?: string;
    deviceName?: string;
  }) => api<AuthResult & { devVerifyCode?: string }>("/auth/login", { method: "POST", body, auth: false }),

  logout: (refreshToken: string) => api("/auth/logout", { method: "POST", body: { refreshToken }, auth: false }),
  me: () => api<{ user: UserPrivate; device: DeviceDto }>("/auth/me"),
  verifyDevice: (id: string, code: string) =>
    api<{ device: DeviceDto }>(`/auth/devices/${id}/verify`, { method: "POST", body: { code } }),
};

// ---- Users ----
export const usersApi = {
  search: (q: string) => api<{ data: UserPublic[] }>("/users/search", { query: { q } }).then((r) => r.data),
  updateProfile: (body: {
    displayName?: string;
    bio?: string;
    privacy?: "public" | "private" | "contacts_only";
    statusKind?: string;
    statusMessage?: string | null;
  }) => api<UserPrivate>("/users/me", { method: "PATCH", body }),
};

// ---- Contacts ----
export const contactsApi = {
  list: () => api<{ data: ContactDto[] }>("/contacts").then((r) => r.data),
  add: (contactUserId: string) => api<ContactDto>("/contacts", { method: "POST", body: { contactUserId } }),
  update: (id: string, body: { state?: "accepted" | "blocked"; alias?: string; favorite?: boolean; pinned?: boolean }) =>
    api<ContactDto>(`/contacts/${id}`, { method: "PATCH", body }),
  respond: (id: string, accept: boolean) =>
    api<ContactDto>(`/contacts/${id}/respond`, { method: "POST", body: { accept } }),
  cancel: (id: string) => api(`/contacts/${id}/cancel`, { method: "POST", body: {} }),
  block: (userId: string) => api("/contacts/block", { method: "POST", body: { userId } }),
  unblock: (userId: string) => api("/contacts/unblock", { method: "POST", body: { userId } }),
  remove: (id: string) => api(`/contacts/${id}`, { method: "DELETE" }),
};

// ---- Notifications ----
export const notificationsApi = {
  list: () =>
    api<{ data: import("@nexa/shared").NotificationDto[]; unread: number }>("/notifications"),
  markAllRead: () => api("/notifications/read-all", { method: "POST", body: {} }),
  markRead: (id: string) => api(`/notifications/${id}/read`, { method: "POST", body: {} }),
};

// ---- Conversations & messages ----
export const conversationsApi = {
  list: () =>
    api<{ data: Array<{ id: string; participants: UserPublic[]; lastMessage: MessageDto | null; unread: number }> }>(
      "/conversations",
    ).then((r) => r.data),
  getOrCreateDirect: (participantId: string) =>
    api<{ id: string }>("/conversations", { method: "POST", body: { participantId } }).then((r) => r.id),
  history: (id: string, before?: string) =>
    api<{ data: MessageDto[] }>(`/conversations/${id}/messages`, { query: { before, limit: 50 } }).then((r) => r.data),
  sendFallback: (id: string, body: unknown) =>
    api<MessageDto>(`/conversations/${id}/messages`, { method: "POST", body }),
};

export const messagesApi = {
  syncPull: (since?: string) =>
    api<{ data: MessageDto[] }>("/messages/sync", { query: { since } }).then((r) => r.data),
  syncPush: (messages: unknown[]) => api<{ accepted: string[] }>("/messages/sync", { method: "POST", body: { messages } }),
};

// ---- Calls ----
export const callsApi = {
  history: () => api<{ data: CallDto[] }>("/calls").then((r) => r.data),
  turnCredentials: () => api<TurnCredentials>("/turn/credentials"),
};

// ---- Media (Backblaze B2 via presigned URLs) ----
export const mediaApi = {
  uploadUrl: (body: { kind: "voice_note" | "video_note" | "image" | "file" | "avatar"; contentType: string; sizeBytes: number; durationMs?: number }) =>
    api<{ objectId: string; uploadUrl: string; method: string; headers: Record<string, string> }>("/media/upload-url", {
      method: "POST",
      body,
    }),
  commit: (objectId: string) => api(`/media/${objectId}/commit`, { method: "POST", body: {} }),
  downloadUrl: (objectId: string) =>
    api<{ url: string; contentType: string | null; expiresIn: number }>(`/media/${objectId}/download-url`),
};

// ---- Devices / networks ----
export const devicesApi = {
  list: () => api<{ data: DeviceDto[] }>("/devices").then((r) => r.data),
  revoke: (id: string) => api(`/devices/${id}`, { method: "DELETE" }),
};

export const networksApi = {
  list: () => api<{ data: unknown[] }>("/networks").then((r) => r.data),
};

// ---- Keys (E2EE) with an in-memory public-key cache ----
const keyCache = new Map<string, string>();
export const keysApi = {
  async publicKeyOf(userId: string): Promise<string> {
    const cached = keyCache.get(userId);
    if (cached) return cached;
    const bundle = await api<PublicKeyBundle>(`/keys/${userId}`);
    keyCache.set(userId, bundle.identityPub);
    return bundle.identityPub;
  },
};

// ---- Admin ----
export const adminApi = {
  stats: () =>
    api<{
      users: number;
      devices: number;
      messages: number;
      calls: number;
      onlineUsers: number;
      activeCalls: number;
      timestamp: string;
    }>("/admin/stats"),
  users: (q?: string) => api<{ data: UserPrivate[] }>("/admin/users", { query: { q } }).then((r) => r.data),
  updateUser: (id: string, body: { status?: string; role?: string }) =>
    api<UserPrivate>(`/admin/users/${id}`, { method: "PATCH", body }),
  devices: () => api<{ data: DeviceDto[] }>("/admin/devices").then((r) => r.data),
  networks: () => api<{ data: unknown[] }>("/admin/networks").then((r) => r.data),
  calls: () => api<{ data: CallDto[] }>("/admin/calls").then((r) => r.data),
  audit: () => api<{ data: unknown[] }>("/admin/audit").then((r) => r.data),
};

// ---- Network access lock (admin) ----
export interface AccessNetwork {
  id: string;
  cidr: string;
  label: string | null;
  createdAt: string;
}
export const accessApi = {
  get: () => api<{ enabled: boolean; networks: AccessNetwork[]; yourIp: string }>("/admin/access"),
  setLock: (enabled: boolean) => api<{ enabled: boolean }>("/admin/access/lock", { method: "POST", body: { enabled } }),
  addNetwork: (cidr: string, label?: string) =>
    api<AccessNetwork>("/admin/access/networks", { method: "POST", body: { cidr, label } }),
  removeNetwork: (id: string) => api(`/admin/access/networks/${id}`, { method: "DELETE" }),
};
