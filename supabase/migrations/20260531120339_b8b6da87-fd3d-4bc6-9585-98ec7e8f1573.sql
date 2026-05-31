
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  google_sheet_id text,
  last_sheets_sync_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins update settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (true);

INSERT INTO public.app_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
