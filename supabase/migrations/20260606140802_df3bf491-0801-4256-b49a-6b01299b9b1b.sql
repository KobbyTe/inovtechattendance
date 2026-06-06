
CREATE TABLE public.session_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE SET NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  date date NOT NULL,
  class_rating integer NOT NULL CHECK (class_rating BETWEEN 1 AND 5),
  enjoyment boolean,
  achievements text,
  class_feedback text,
  teacher_note text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.session_reviews TO anon, authenticated;
GRANT SELECT ON public.session_reviews TO authenticated;
GRANT ALL ON public.session_reviews TO service_role;

ALTER TABLE public.session_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit reviews"
  ON public.session_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read reviews"
  ON public.session_reviews FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_session_reviews_date ON public.session_reviews(date DESC);
CREATE INDEX idx_session_reviews_cohort ON public.session_reviews(cohort_id);
