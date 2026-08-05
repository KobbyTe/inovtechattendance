CREATE TABLE public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  installment_count integer NOT NULL DEFAULT 1,
  installment_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment plans" ON public.payment_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert payment plans" ON public.payment_plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update payment plans" ON public.payment_plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payment plans" ON public.payment_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.student_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payment_plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','defaulted','waived')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, payment_plan_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_payment_plans TO authenticated;
GRANT ALL ON public.student_payment_plans TO service_role;
ALTER TABLE public.student_payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read student plans" ON public.student_payment_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert student plans" ON public.student_payment_plans FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update student plans" ON public.student_payment_plans FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete student plans" ON public.student_payment_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_payment_plan_id uuid NOT NULL REFERENCES public.student_payment_plans(id) ON DELETE CASCADE,
  installment_label text NOT NULL,
  amount_due numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','overdue','waived')),
  balance_remaining numeric(10,2) NOT NULL,
  waived_by uuid,
  waived_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_plan_idx ON public.invoices (student_payment_plan_id);
CREATE INDEX invoices_due_idx ON public.invoices (due_date, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  channel text NOT NULL CHECK (channel IN ('momo','card','bank','cash','manual')),
  provider text,
  provider_reference text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('initiated','success','failed','refunded')),
  overpayment_amount numeric(10,2) NOT NULL DEFAULT 0,
  note text,
  recorded_by uuid,
  paid_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_provider_reference_key ON public.payments (provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX payments_student_idx ON public.payments (student_id);
CREATE INDEX payments_invoice_idx ON public.payments (invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payments" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  inv RECORD;
  paid_total numeric(10,2);
  new_balance numeric(10,2);
  overpay numeric(10,2) := 0;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = _payment_id;
  IF p IS NULL OR p.invoice_id IS NULL OR p.status <> 'success' THEN RETURN; END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = p.invoice_id FOR UPDATE;
  IF inv IS NULL OR inv.status = 'waived' THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_total
  FROM public.payments WHERE invoice_id = inv.id AND status = 'success';

  new_balance := inv.amount_due - paid_total;
  IF new_balance < 0 THEN
    overpay := -new_balance;
    new_balance := 0;
  END IF;

  UPDATE public.invoices
  SET balance_remaining = new_balance,
      status = CASE
        WHEN new_balance <= 0 THEN 'paid'
        WHEN paid_total > 0 THEN 'partial'
        WHEN due_date < (now() AT TIME ZONE 'utc')::date THEN 'overdue'
        ELSE 'pending' END,
      updated_at = now()
  WHERE id = inv.id;

  UPDATE public.payments SET overpayment_amount = overpay WHERE id = p.id;

  UPDATE public.student_payment_plans sp
  SET status = 'completed'
  WHERE sp.id = inv.student_payment_plan_id
    AND sp.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.student_payment_plan_id = sp.id
        AND i.status NOT IN ('paid','waived')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.invoices
  SET status = 'overdue', updated_at = now()
  WHERE status IN ('pending','partial')
    AND balance_remaining > 0
    AND due_date < (now() AT TIME ZONE 'utc')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payment_to_invoice(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_to_invoice(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;