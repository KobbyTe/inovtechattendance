
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS email_header_image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read email-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

CREATE POLICY "Admins upload email-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-assets');

CREATE POLICY "Admins update email-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'email-assets');

CREATE POLICY "Admins delete email-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'email-assets');
