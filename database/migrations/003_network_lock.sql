-- ============================================================================
-- Migration 003 — network access lock (offline/on-prem deployments).
-- An admin registers approved network ranges (CIDRs). When the lock is ON,
-- only clients whose IP falls in an approved range can USE the app.
-- Additive & idempotent.
-- ============================================================================

-- Simple global key/value settings (holds the network-lock on/off flag).
CREATE TABLE IF NOT EXISTS app_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Approved network ranges (CIDR, e.g. 192.168.1.0/24, or a single IP as /32).
CREATE TABLE IF NOT EXISTS access_networks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cidr        text NOT NULL,
    label       text,
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_networks_created ON access_networks(created_at);
