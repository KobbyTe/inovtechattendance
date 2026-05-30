
-- 1. Cohorts table
CREATE TABLE public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  duration_weeks integer,
  start_date date,
  end_date date,
  is_ongoing boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cohorts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;
GRANT ALL ON public.cohorts TO service_role;

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cohorts" ON public.cohorts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert cohorts" ON public.cohorts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update cohorts" ON public.cohorts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete cohorts" ON public.cohorts FOR DELETE TO authenticated USING (true);

-- 2. Seed default cohort
INSERT INTO public.cohorts (name, code, is_ongoing, color)
VALUES ('Future Skills Bootcamp', 'FSB', true, '#3b82f6');

-- 3. Extend students
ALTER TABLE public.students
  ADD COLUMN cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  ADD COLUMN guardian_name text,
  ADD COLUMN guardian_email text,
  ADD COLUMN student_email text;

-- Backfill existing students to default cohort
UPDATE public.students
SET cohort_id = (SELECT id FROM public.cohorts WHERE code = 'FSB' LIMIT 1)
WHERE cohort_id IS NULL;

CREATE INDEX idx_students_cohort_id ON public.students(cohort_id);
