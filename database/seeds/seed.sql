-- ============================================================================
-- Nexa — dev seed data
-- Password for ALL seed users is: "Password123!"
-- The hash below is Argon2id of that password (replace via `npm run seed` which
-- hashes dynamically; this file is a fallback for raw psql loading in dev only).
-- ============================================================================

-- NOTE: prefer `npm run seed --workspace backend` (hashes passwords properly).
-- This SQL uses a placeholder hash and is intended for quick local smoke tests.

INSERT INTO users (id, username, email, password_hash, display_name, role, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'admin@nexa.local',
   '$argon2id$v=19$m=19456,t=2,p=1$PLACEHOLDER_REPLACE_VIA_SEED_SCRIPT', 'Nexa Admin', 'admin', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'alice', 'alice@nexa.local',
   '$argon2id$v=19$m=19456,t=2,p=1$PLACEHOLDER_REPLACE_VIA_SEED_SCRIPT', 'Alice', 'user', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'bob', 'bob@nexa.local',
   '$argon2id$v=19$m=19456,t=2,p=1$PLACEHOLDER_REPLACE_VIA_SEED_SCRIPT', 'Bob', 'user', 'active')
ON CONFLICT (id) DO NOTHING;

-- Alice and Bob are mutually accepted contacts
INSERT INTO contacts (owner_id, contact_user_id, state)
VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'accepted'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'accepted')
ON CONFLICT (owner_id, contact_user_id) DO NOTHING;

-- A demo approved network for offline mode
INSERT INTO networks (owner_id, ssid_hash, local_identifier, label, approved, permissions)
VALUES
  ('00000000-0000-0000-0000-000000000002',
   'sha256:demo-ssid-hash', 'nexa-demo-lan', 'Demo LAN', true,
   '{"allowDiscovery": true, "autoAcceptCalls": false}'::jsonb)
ON CONFLICT DO NOTHING;
