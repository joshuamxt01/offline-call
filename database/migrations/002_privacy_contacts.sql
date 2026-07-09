-- ============================================================================
-- Migration 002 — privacy, user status, and contact management extensions.
-- Additive & idempotent. Safe to run on an existing (populated) database.
-- ============================================================================

-- Users: privacy + presence status
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy text NOT NULL DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_kind text NOT NULL DEFAULT 'available';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_message text;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_users_privacy
    CHECK (privacy IN ('public','private','contacts_only'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Contacts: request directionality + favorites/pins
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- Notifications (future-proof: contact requests, calls, messages, system).
CREATE TABLE IF NOT EXISTS notifications (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         text NOT NULL,          -- contact_request | request_accepted | request_rejected
                                          -- | incoming_call | missed_call | new_message | voice_message | video_message
    actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at      timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

-- Future-proof grouping: conversations already carry a `type` (direct|group).
-- A generic membership/role table lets groups, broadcast lists, communities and
-- channels reuse the same model without a refactor later.
DO $$ BEGIN
  ALTER TABLE conversations ADD CONSTRAINT chk_conversations_type
    CHECK (type IN ('direct','group','broadcast','community','channel'));
EXCEPTION WHEN duplicate_object THEN
  ALTER TABLE conversations DROP CONSTRAINT chk_conversations_type;
  ALTER TABLE conversations ADD CONSTRAINT chk_conversations_type
    CHECK (type IN ('direct','group','broadcast','community','channel'));
END $$;
