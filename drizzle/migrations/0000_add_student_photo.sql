ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT;
COMMENT ON COLUMN public.students.photo_url IS 'Passport-size student photo, stored as a compressed data URL.';