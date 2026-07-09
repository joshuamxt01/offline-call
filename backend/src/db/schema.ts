import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  bigserial,
  jsonb,
  customType,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** bytea custom type (ciphertext, keys). Maps Buffer <-> Postgres bytea. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  avatarObjectId: uuid("avatar_object_id"),
  bio: text("bio"),
  status: text("status").notNull().default("active"),
  role: text("role").notNull().default("user"),
  // Privacy level: public (searchable) | private (hidden) | contacts_only (approved contacts only)
  privacy: text("privacy").notNull().default("public"),
  // Availability the user sets: available | busy | in_meeting | at_work | away | dnd | custom
  statusKind: text("status_kind").notNull().default("available"),
  statusMessage: text("status_message"),
  // Network partition the account was created on: an approved network id (office
  // Wi-Fi) or "online". When the network lock is on, users only see/contact others
  // in the same partition, and a login is only allowed on the account's network.
  networkPartition: text("network_partition"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceName: text("device_name"),
    platform: text("platform").notNull(),
    pushToken: text("push_token"),
    verified: boolean("verified").notNull().default(false),
    verifyCode: text("verify_code"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    lastNetworkId: uuid("last_network_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("idx_devices_user").on(t.userId),
    byActive: index("idx_devices_active").on(t.lastActiveAt),
  }),
);

export const deviceKeys = pgTable(
  "device_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    identityPub: bytea("identity_pub").notNull(),
    signedPrekey: bytea("signed_prekey"),
    signedPrekeySig: bytea("signed_prekey_sig"),
    oneTimePrekeys: jsonb("one_time_prekeys").notNull().default([]),
    algo: text("algo").notNull().default("x25519-xchacha20poly1305"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (t) => ({ byDevice: index("idx_device_keys_device").on(t.deviceId) }),
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    familyId: uuid("family_id").notNull(),
    used: boolean("used").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byDevice: index("idx_refresh_device").on(t.deviceId),
    byHash: uniqueIndex("idx_refresh_hash").on(t.tokenHash),
    byFamily: index("idx_refresh_family").on(t.familyId),
  }),
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactUserId: uuid("contact_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alias: text("alias"),
    state: text("state").notNull().default("pending"),
    // Directionality for the request workflow: who sent the pending request.
    requestedBy: uuid("requested_by"),
    favorite: boolean("favorite").notNull().default(false),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOwner: index("idx_contacts_owner").on(t.ownerId),
    uniquePair: uniqueIndex("uq_contacts_pair").on(t.ownerId, t.contactUserId),
  }),
);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull().default("direct"),
  title: text("title"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadMessageId: text("last_read_message_id"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.conversationId, t.userId] }),
    byUser: index("idx_convmembers_user").on(t.userId),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(), // ULID from client
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("text"),
    ciphertext: bytea("ciphertext").notNull(),
    nonce: bytea("nonce").notNull(),
    mediaObjectId: uuid("media_object_id"),
    clientCreatedAt: timestamp("client_created_at", { withTimezone: true }).notNull(),
    serverCreatedAt: timestamp("server_created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("sent"),
  },
  (t) => ({
    byConvTime: index("idx_messages_conv_time").on(t.conversationId, t.serverCreatedAt),
    bySync: index("idx_messages_sync").on(t.conversationId, t.serverCreatedAt, t.id),
  }),
);

export const messageReceipts = pgTable(
  "message_receipts",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.messageId, t.userId] }) }),
);

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    callerId: uuid("caller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    transport: text("transport"),
    status: text("status").notNull().default("ringing"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    endReason: text("end_reason"),
  },
  (t) => ({ byCallerTime: index("idx_calls_caller_time").on(t.callerId, t.startedAt) }),
);

export const callParticipants = pgTable(
  "call_participants",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.callId, t.userId] }) }),
);

export const mediaObjects = pgTable(
  "media_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    bucketKey: text("bucket_key").notNull(),
    contentType: text("content_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    durationMs: integer("duration_ms"),
    encrypted: boolean("encrypted").notNull().default(true),
    committed: boolean("committed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byOwner: index("idx_media_owner").on(t.ownerId) }),
);

export const networks = pgTable(
  "networks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ssidHash: text("ssid_hash").notNull(),
    bssidHash: text("bssid_hash"),
    localIdentifier: text("local_identifier").notNull(),
    label: text("label"),
    permissions: jsonb("permissions").notNull().default({}),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byOwner: index("idx_networks_owner").on(t.ownerId) }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    target: text("target"),
    ip: text("ip"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byActor: index("idx_audit_actor").on(t.actorUserId),
    byTime: index("idx_audit_time").on(t.createdAt),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byUser: index("idx_notifications_user").on(t.userId, t.createdAt) }),
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accessNetworks = pgTable(
  "access_networks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cidr: text("cidr").notNull(),
    label: text("label"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byCreated: index("idx_access_networks_created").on(t.createdAt) }),
);

// Convenience row types
export type UserRow = typeof users.$inferSelect;
export type DeviceRow = typeof devices.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type CallRow = typeof calls.$inferSelect;
export type MediaRow = typeof mediaObjects.$inferSelect;
export type NetworkRow = typeof networks.$inferSelect;
