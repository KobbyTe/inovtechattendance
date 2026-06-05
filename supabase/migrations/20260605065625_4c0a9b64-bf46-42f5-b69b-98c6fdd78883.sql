
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.claim_admin_if_none()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (uid, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO authenticated;

DROP POLICY IF EXISTS "Admins insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins update settings" ON public.app_settings;

CREATE POLICY "Admins read settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public can read students" ON public.students;
DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
CREATE POLICY "Authenticated read students"
  ON public.students FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT ON public.students FROM anon;

DROP POLICY IF EXISTS "Public can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public can read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Public can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Authenticated read attendance" ON public.attendance;
CREATE POLICY "Authenticated read attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT, INSERT, UPDATE ON public.attendance FROM anon;

DROP POLICY IF EXISTS "Public can read absences" ON public.absences;
DROP POLICY IF EXISTS "Service can insert absences" ON public.absences;
DROP POLICY IF EXISTS "Authenticated read absences" ON public.absences;
CREATE POLICY "Authenticated read absences"
  ON public.absences FOR SELECT TO authenticated
  USING (true);

REVOKE SELECT, INSERT ON public.absences FROM anon;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance;
EXCEPTION WHEN undefined_object THEN NULL; WHEN undefined_table THEN NULL; END $$;
