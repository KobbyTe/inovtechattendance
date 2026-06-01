ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS email_header text,
  ADD COLUMN IF NOT EXISTS email_signature text;