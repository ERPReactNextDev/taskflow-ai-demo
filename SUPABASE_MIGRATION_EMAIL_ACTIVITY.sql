-- =============================================
-- ADD EMAIL TRACKING TO EXISTING ACTIVITY TABLE
-- Soft link: 1 Activity ↔ 1 Source Email (nullable)
-- Run this in Supabase SQL Editor
-- =============================================

ALTER TABLE public.activity
  ADD COLUMN IF NOT EXISTS source_email_message_id text NULL;

-- Index for fast lookup of all activities linked to one email
CREATE INDEX IF NOT EXISTS idx_activity_source_email
  ON public.activity(source_email_message_id);

-- Comment for future developers
COMMENT ON COLUMN public.activity.source_email_message_id IS
  'Email Message ID (from Email Module IMAP uid/message_id) — tracks which email started this activity. Format: "uid:<folder>:<uid>" e.g. "uid:INBOX:12345"';
