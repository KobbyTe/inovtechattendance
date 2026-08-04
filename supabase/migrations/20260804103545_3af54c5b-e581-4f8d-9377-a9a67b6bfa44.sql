CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  title text NOT NULL,
  body_html text NOT NULL,
  body_plain text NOT NULL,
  flyer_image_url text,
  program_form_link text,
  slug text NOT NULL UNIQUE,
  target_audience text NOT NULL DEFAULT 'current_students'
    CHECK (target_audience IN ('current_students','alumni','all','custom')),
  audience_filter jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','sent')),
  scheduled_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.announcement_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  student_id text REFERENCES public.students(student_id) ON DELETE SET NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('student','guardian')),
  channel text NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
  contact_value text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','failed','bounced','skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (announcement_id, channel, contact_value)
);

CREATE INDEX announcement_recipients_pending_idx
  ON public.announcement_recipients (announcement_id, status);

ALTER TABLE public.students
  ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false;

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

GRANT SELECT ON public.announcement_recipients TO authenticated;
GRANT ALL ON public.announcement_recipients TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read announcements" ON public.announcements
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert announcements" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update announcements" ON public.announcements
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete announcements" ON public.announcements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public can read sent announcements" ON public.announcements
  FOR SELECT TO anon USING (status = 'sent');

CREATE POLICY "Admins read announcement recipients" ON public.announcement_recipients
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));