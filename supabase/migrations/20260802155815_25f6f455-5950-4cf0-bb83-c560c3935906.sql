ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.cohorts DROP CONSTRAINT IF EXISTS cohorts_status_check;
ALTER TABLE public.cohorts ADD CONSTRAINT cohorts_status_check CHECK (status IN ('upcoming','active','ended'));

ALTER TABLE public.cohorts ALTER COLUMN ended_at TYPE timestamptz USING ended_at::timestamptz;

UPDATE public.cohorts SET status = CASE
  WHEN is_ended THEN 'ended'
  WHEN start_date IS NULL OR start_date <= (now() AT TIME ZONE 'utc')::date THEN 'active'
  ELSE 'upcoming'
END;

CREATE TABLE public.cohort_status_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text NOT NULL,
  admin_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cohort_status_overrides TO authenticated;
GRANT ALL ON public.cohort_status_overrides TO service_role;
ALTER TABLE public.cohort_status_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cohort status overrides" ON public.cohort_status_overrides
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.cohort_yearbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_id uuid NOT NULL UNIQUE REFERENCES public.cohorts(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cohort_yearbooks TO authenticated;
GRANT ALL ON public.cohort_yearbooks TO service_role;
ALTER TABLE public.cohort_yearbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read cohort yearbooks" ON public.cohort_yearbooks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));