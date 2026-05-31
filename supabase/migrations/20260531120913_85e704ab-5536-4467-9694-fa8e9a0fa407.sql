
CREATE TABLE public.absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  student_name text NOT NULL,
  date date NOT NULL,
  day_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX absences_date_idx ON public.absences(date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.absences TO authenticated;
GRANT SELECT, INSERT ON public.absences TO anon;
GRANT ALL ON public.absences TO service_role;

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read absences" ON public.absences
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert absences" ON public.absences
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service can insert absences" ON public.absences
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins delete absences" ON public.absences
  FOR DELETE TO authenticated USING (true);
