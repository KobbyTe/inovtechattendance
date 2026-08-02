ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS is_ended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ended_at date;