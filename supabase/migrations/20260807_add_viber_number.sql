-- Add viber_number to the custom users table (not auth.users — the app uses a custom table)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS viber_number text NULL;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_viber_number ON public.users (viber_number)
  WHERE viber_number IS NOT NULL;
