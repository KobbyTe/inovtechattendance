CREATE TABLE IF NOT EXISTS public.invoice_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, kind)
);

GRANT SELECT ON public.invoice_notifications TO authenticated;
GRANT ALL ON public.invoice_notifications TO service_role;
ALTER TABLE public.invoice_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read invoice notifications"
ON public.invoice_notifications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS payment_notify_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_reminder_days_before integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS payment_overdue_cadence integer[] NOT NULL DEFAULT '{1,7,14}',
  ADD COLUMN IF NOT EXISTS payment_receipt_subject text,
  ADD COLUMN IF NOT EXISTS payment_receipt_body text,
  ADD COLUMN IF NOT EXISTS payment_reminder_subject text,
  ADD COLUMN IF NOT EXISTS payment_reminder_body text,
  ADD COLUMN IF NOT EXISTS payment_overdue_subject text,
  ADD COLUMN IF NOT EXISTS payment_overdue_body text,
  ADD COLUMN IF NOT EXISTS payment_receipt_sms text,
  ADD COLUMN IF NOT EXISTS payment_reminder_sms text,
  ADD COLUMN IF NOT EXISTS payment_overdue_sms text,
  ADD COLUMN IF NOT EXISTS whatsapp_payment_received_template text,
  ADD COLUMN IF NOT EXISTS whatsapp_payment_reminder_template text,
  ADD COLUMN IF NOT EXISTS whatsapp_payment_overdue_template text;

CREATE INDEX IF NOT EXISTS idx_notification_log_invoice ON public.notification_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_status ON public.invoices(due_date, status);