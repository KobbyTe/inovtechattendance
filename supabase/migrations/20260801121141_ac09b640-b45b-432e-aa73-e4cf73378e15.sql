ALTER TABLE public.students ADD COLUMN IF NOT EXISTS rfid_uid text;
CREATE UNIQUE INDEX IF NOT EXISTS students_rfid_uid_key ON public.students (rfid_uid) WHERE rfid_uid IS NOT NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'qr';