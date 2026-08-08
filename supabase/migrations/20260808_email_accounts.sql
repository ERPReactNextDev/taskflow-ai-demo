-- ============================================================
-- EMAIL MODULE: 1 TABLE ONLY
-- RULE: Zero email content ever stored here. Credentials ONLY.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.email_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,                          -- matches custom users.id (text)
  display_name  text NOT NULL,
  email_address text NOT NULL,
  password      text NOT NULL,                          -- encrypted via pgcrypto at insert time (app layer AES)

  -- Auto-detected / manually set server settings (nullable until detected)
  provider            text NULL,                        -- e.g. "cpanel", "gmail", "outlook"
  smtp_host           text NULL,
  smtp_port           integer NULL,
  smtp_encryption     text NULL CHECK (smtp_encryption IN ('STARTTLS','SSL','NONE') OR smtp_encryption IS NULL),
  smtp_username       text NULL,
  imap_host           text NULL,
  imap_port           integer NULL,
  imap_encryption     text NULL CHECK (imap_encryption IN ('SSL','STARTTLS','NONE') OR imap_encryption IS NULL),
  imap_username       text NULL,

  -- UX settings
  signature           text NULL,
  is_default          boolean NOT NULL DEFAULT false,

  -- Timestamps
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

-- Index for fast per-user lookup
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON public.email_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_default ON public.email_accounts (user_id, is_default);

-- Auto updated_at
CREATE OR REPLACE FUNCTION public.fn_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER trg_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_email_accounts_updated_at();

-- RLS: owner-only
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Since app uses custom auth (not Supabase auth), policies use service role for all writes.
-- Client reads are handled via the API layer (service role), not direct RLS.
-- These policies protect against direct DB access by non-service-role clients.
CREATE POLICY email_accounts_select ON public.email_accounts
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY email_accounts_insert ON public.email_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY email_accounts_update ON public.email_accounts
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY email_accounts_delete ON public.email_accounts
  FOR DELETE USING (user_id = auth.uid()::text);

-- ============================================================
-- DONE: 1 table, 1 trigger, 4 RLS policies. Nothing else.
-- ============================================================
