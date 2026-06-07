
-- 1. session_reviews: stop trusting client inserts (server function uses service role)
DROP POLICY IF EXISTS "Anyone can submit reviews" ON public.session_reviews;
CREATE POLICY "Block direct review inserts"
  ON public.session_reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- 2. cohorts: replace true-based admin policies with role checks
DROP POLICY IF EXISTS "Admins can insert cohorts" ON public.cohorts;
DROP POLICY IF EXISTS "Admins can update cohorts" ON public.cohorts;
DROP POLICY IF EXISTS "Admins can delete cohorts" ON public.cohorts;
CREATE POLICY "Admins can insert cohorts" ON public.cohorts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update cohorts" ON public.cohorts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete cohorts" ON public.cohorts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. students: restrict read + write to admins
DROP POLICY IF EXISTS "Admins can insert students" ON public.students;
DROP POLICY IF EXISTS "Admins can update students" ON public.students;
DROP POLICY IF EXISTS "Admins can delete students" ON public.students;
DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
CREATE POLICY "Admins read students" ON public.students
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update students" ON public.students
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete students" ON public.students
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. attendance: restrict read + delete to admins (writes already go through service-role server fns)
DROP POLICY IF EXISTS "Authenticated read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.attendance;
CREATE POLICY "Admins read attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete attendance" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. absences: restrict to admins
DROP POLICY IF EXISTS "Authenticated read absences" ON public.absences;
DROP POLICY IF EXISTS "Admins insert absences" ON public.absences;
DROP POLICY IF EXISTS "Admins delete absences" ON public.absences;
CREATE POLICY "Admins read absences" ON public.absences
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert absences" ON public.absences
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete absences" ON public.absences
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. email-assets storage: require admin role for writes
DROP POLICY IF EXISTS "Admins upload email-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins update email-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete email-assets" ON storage.objects;
CREATE POLICY "Admins upload email-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update email-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete email-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7. Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_admin_if_none() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO authenticated, service_role;
