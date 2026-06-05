
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS clockin_student_subject text,
  ADD COLUMN IF NOT EXISTS clockin_student_body text,
  ADD COLUMN IF NOT EXISTS clockin_guardian_subject text,
  ADD COLUMN IF NOT EXISTS clockin_guardian_body text,
  ADD COLUMN IF NOT EXISTS clockout_student_subject text,
  ADD COLUMN IF NOT EXISTS clockout_student_body text,
  ADD COLUMN IF NOT EXISTS clockout_guardian_subject text,
  ADD COLUMN IF NOT EXISTS clockout_guardian_body text;
