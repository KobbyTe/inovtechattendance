
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  full_name text NOT NULL,
  year_level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  student_name text NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  day_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_date ON public.attendance(date DESC);
CREATE INDEX idx_attendance_student ON public.attendance(student_id);

-- Grants
GRANT SELECT ON public.students TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.attendance TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

-- RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Students policies
CREATE POLICY "Public can read students" ON public.students FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update students" ON public.students FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete students" ON public.students FOR DELETE TO authenticated USING (true);

-- Attendance policies
CREATE POLICY "Public can read attendance" ON public.attendance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert attendance" ON public.attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update attendance" ON public.attendance FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Admins can delete attendance" ON public.attendance FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
