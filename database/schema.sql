-- ============================================================================
-- Nexa — canonical PostgreSQL schema (Neon-compatible)
-- Readable reference DDL. The backend applies this via Drizzle migrations;
-- this file is the human-facing source of truth and mirrors backend/src/db/schema.ts.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive username/email

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username          citext UNIQUE NOT NULL,
    email             citext UNIQUE NOT NULL,
    password_hash     text NOT NULL,
    display_name      text,
    avatar_object_id  uuid,
    bio               text,
    status            text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','deleted')),
    role              text NOT NULL DEFAULT 'user'
                        CHECK (role IN ('user','admin')),
    last_seen_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- DEVICES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name      text,
    platform         text NOT NULL CHECK (platform IN ('android','web')),
    push_token       text,
    verified         boolean NOT NULL DEFAULT false,
    verify_code      text,
    last_active_at   timestamptz,
    last_network_id  uuid,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(last_active_at);

-- ---------------------------------------------------------------------------
-- DEVICE KEYS (public key material for E2EE; private keys never leave device)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_keys (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id          uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    identity_pub       bytea NOT NULL,
    signed_prekey      bytea,
    signed_prekey_sig  bytea,
    one_time_prekeys   jsonb NOT NULL DEFAULT '[]'::jsonb,
    algo               text NOT NULL DEFAULT 'x25519-xchacha20poly1305',
    created_at         timestamptz NOT NULL DEFAULT now(),
    rotated_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_device_keys_device ON device_keys(device_id);

-- ---------------------------------------------------------------------------
-- REFRESH TOKENS (rotation + reuse detection)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    token_hash  text NOT NULL,
    family_id   uuid NOT NULL,
    used        boolean NOT NULL DEFAULT false,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_device ON refresh_tokens(device_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family_id);

-- ---------------------------------------------------------------------------
-- CONTACTS (directed relationship with request lifecycle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias            text,
    state            text NOT NULL DEFAULT 'pending'
                       CHECK (state IN ('pending','accepted','blocked')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner_id, contact_user_id),
    CHECK (owner_id <> contact_user_id)
);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);

-- ---------------------------------------------------------------------------
-- CONVERSATIONS + MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type         text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
    title        text,
    created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id       uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                  text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
    joined_at             timestamptz NOT NULL DEFAULT now(),
    last_read_message_id  text,
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_convmembers_user ON conversation_members(user_id);

-- ---------------------------------------------------------------------------
-- MESSAGES (ciphertext ledger; partition-ready by month)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id                 text PRIMARY KEY,            -- ULID from client (offline-first ordering)
    conversation_id    uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type               text NOT NULL DEFAULT 'text'
                         CHECK (type IN ('text','voice','video','system')),
    ciphertext         bytea NOT NULL,
    nonce              bytea NOT NULL,
    media_object_id    uuid,
    client_created_at  timestamptz NOT NULL,
    server_created_at  timestamptz NOT NULL DEFAULT now(),
    status             text NOT NULL DEFAULT 'sent'
                         CHECK (status IN ('sent','delivered','read'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv_time
    ON messages(conversation_id, server_created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sync
    ON messages(conversation_id, server_created_at, id);

CREATE TABLE IF NOT EXISTS message_receipts (
    message_id    text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivered_at  timestamptz,
    read_at       timestamptz,
    PRIMARY KEY (message_id, user_id)
);

-- ---------------------------------------------------------------------------
-- CALLS + PARTICIPANTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calls (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id   uuid REFERENCES conversations(id) ON DELETE SET NULL,
    caller_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type              text NOT NULL CHECK (type IN ('voice','video')),
    transport         text CHECK (transport IN ('p2p','lan','turn')),
    status            text NOT NULL DEFAULT 'ringing'
                        CHECK (status IN ('ringing','answered','rejected','missed','ended','failed')),
    started_at        timestamptz NOT NULL DEFAULT now(),
    answered_at       timestamptz,
    ended_at          timestamptz,
    duration_seconds  integer,
    end_reason        text
);
CREATE INDEX IF NOT EXISTS idx_calls_caller_time ON calls(caller_id, started_at);

CREATE TABLE IF NOT EXISTS call_participants (
    call_id    uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id  uuid REFERENCES devices(id) ON DELETE SET NULL,
    joined_at  timestamptz,
    left_at    timestamptz,
    PRIMARY KEY (call_id, user_id)
);

-- ---------------------------------------------------------------------------
-- MEDIA OBJECTS (Backblaze B2 pointers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_objects (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind          text NOT NULL CHECK (kind IN ('avatar','voice_note','video_note')),
    bucket_key    text NOT NULL,
    content_type  text,
    size_bytes    bigint,
    duration_ms   integer,
    encrypted     boolean NOT NULL DEFAULT true,
    committed     boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_owner ON media_objects(owner_id);

-- ---------------------------------------------------------------------------
-- NETWORKS (approved LANs for offline mode + permissions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS networks (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ssid_hash         text NOT NULL,
    bssid_hash        text,
    local_identifier  text NOT NULL,
    label             text,
    permissions       jsonb NOT NULL DEFAULT '{}'::jsonb,
    approved          boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_networks_owner ON networks(owner_id);

-- ---------------------------------------------------------------------------
-- AUDIT LOG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id             bigserial PRIMARY KEY,
    actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
    action         text NOT NULL,
    target         text,
    ip             inet,
    metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);

-- Deferred FKs that reference later tables
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS fk_users_avatar,
    ADD CONSTRAINT fk_users_avatar
    FOREIGN KEY (avatar_object_id) REFERENCES media_objects(id) ON DELETE SET NULL;

ALTER TABLE devices
    DROP CONSTRAINT IF EXISTS fk_devices_network,
    ADD CONSTRAINT fk_devices_network
    FOREIGN KEY (last_network_id) REFERENCES networks(id) ON DELETE SET NULL;
