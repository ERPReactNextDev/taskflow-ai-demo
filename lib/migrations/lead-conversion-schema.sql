-- ─────────────────────────────────────────────────────────────────────────────
-- Lead-to-Client Conversion Engine — Schema Migration
-- Run this once in your Neon (PostgreSQL) database
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add conversion tracking columns to the accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS conversion_status      TEXT DEFAULT 'NEW LEAD',
  ADD COLUMN IF NOT EXISTS conversion_probability INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_flags       TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_stage         TEXT DEFAULT 'Unqualified',
  ADD COLUMN IF NOT EXISTS last_conversion_check  TIMESTAMPTZ;

-- 2. Conversion audit log table
CREATE TABLE IF NOT EXISTS conversion_audit_log (
  id                       BIGSERIAL PRIMARY KEY,
  account_reference_number TEXT NOT NULL,
  old_status               TEXT,
  new_status               TEXT NOT NULL,
  trigger_activity         TEXT,
  trigger_timestamp        TIMESTAMPTZ,
  user_id                  TEXT,
  timestamp                TIMESTAMPTZ DEFAULT NOW(),
  flags                    TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversion_audit_ref
  ON conversion_audit_log (account_reference_number, timestamp DESC);

-- 3. Backfill conversion_status for all existing accounts
UPDATE accounts SET
  conversion_status      = CASE
    WHEN LOWER(status) = 'active'  THEN 'OFFICIAL CLIENT'
    WHEN LOWER(status) = 'inactive' THEN 'NEW LEAD'
    ELSE 'NEW LEAD'
  END,
  conversion_probability = CASE
    WHEN LOWER(status) = 'active'  THEN 100
    ELSE 0
  END,
  pipeline_stage = CASE
    WHEN LOWER(status) = 'active'  THEN 'Closed / Won'
    ELSE 'Unqualified'
  END
WHERE conversion_status IS NULL OR conversion_status = '';

-- 4. Index for fast pipeline queries
CREATE INDEX IF NOT EXISTS idx_accounts_conversion
  ON accounts (referenceid, conversion_status, pipeline_stage);

CREATE INDEX IF NOT EXISTS idx_accounts_pipeline
  ON accounts (pipeline_stage, referenceid);
