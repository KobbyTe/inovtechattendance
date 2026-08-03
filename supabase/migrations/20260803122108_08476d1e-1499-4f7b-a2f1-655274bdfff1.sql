ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS guardian_msg_opt_out boolean NOT NULL DEFAULT false;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_sender_id text,
  ADD COLUMN IF NOT EXISTS absence_sms_template text,
  ADD COLUMN IF NOT EXISTS whatsapp_template_name text,
  ADD COLUMN IF NOT EXISTS whatsapp_template_lang text NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text,
  student_name text,
  channel text NOT NULL,
  recipient text NOT NULL,
  provider text NOT NULL,
  kind text NOT NULL DEFAULT 'absence',
  date date,
  body text,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notification log"
  ON public.notification_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS notification_log_date_idx ON public.notification_log (date DESC, created_at DESC);