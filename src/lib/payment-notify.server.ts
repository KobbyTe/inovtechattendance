/**
 * Payment notifications (server-only). New templates on the Phase 1 rails:
 * Gmail for email (+ PDF receipt attachment), Arkesel SMS and Meta WhatsApp
 * for guardian messaging. Every send is logged in notification_log and
 * milestone sends are de-duplicated through invoice_notifications.
 */

type DB = { from: (t: string) => any; rpc?: (fn: string, args?: any) => any };

export type NotifyKind = "receipt" | "reminder" | `overdue_${number}` | string;

const DEFAULTS = {
  receiptSubject: "Payment received — {{amount}} for {{installment}}",
  receiptBody:
    "{{greeting}}\n\nWe have received {{amount}} for {{installment}} ({{planName}}).\n\nRemaining balance on this installment: {{balance}}.\nPaid on {{paidAt}} via {{channel}}.\n\nYour receipt is attached as a PDF.",
  reminderSubject: "Reminder: {{installment}} of {{balance}} is due {{dueDate}}",
  reminderBody:
    "{{greeting}}\n\nThis is a reminder that {{installment}} ({{planName}}) of {{balance}} is due on {{dueDate}}.\n\nYou can pay online using this link:\n{{payLink}}",
  overdueSubject: "Overdue: {{installment}} — {{balance}} outstanding",
  overdueBody:
    "{{greeting}}\n\n{{installment}} ({{planName}}) of {{balance}} was due on {{dueDate}} and is now {{daysOverdue}} day(s) overdue.\n\nYou can settle it online here:\n{{payLink}}\n\nIf you have already paid, please ignore this message.",
  receiptSms:
    "Inovtech: payment of {{amount}} received for {{installment}}. Balance: {{balance}}. Thank you.",
  reminderSms:
    "Inovtech: {{installment}} of {{balance}} for {{studentName}} is due on {{dueDate}}. Pay: {{payLink}}",
  overdueSms:
    "Inovtech: {{installment}} of {{balance}} for {{studentName}} was due {{dueDate}} ({{daysOverdue}} day(s) overdue). Pay: {{payLink}}",
};

export type PaymentSettings = {
  payment_notify_enabled?: boolean | null;
  payment_reminder_days_before?: number | null;
  payment_overdue_cadence?: number[] | null;
  payment_receipt_subject?: string | null;
  payment_receipt_body?: string | null;
  payment_reminder_subject?: string | null;
  payment_reminder_body?: string | null;
  payment_overdue_subject?: string | null;
  payment_overdue_body?: string | null;
  payment_receipt_sms?: string | null;
  payment_reminder_sms?: string | null;
  payment_overdue_sms?: string | null;
  whatsapp_payment_received_template?: string | null;
  whatsapp_payment_reminder_template?: string | null;
  whatsapp_payment_overdue_template?: string | null;
  email_header_image_url?: string | null;
  email_signature?: string | null;
  sms_enabled?: boolean | null;
  whatsapp_enabled?: boolean | null;
  sms_sender_id?: string | null;
  whatsapp_template_lang?: string | null;
};

export async function loadPaymentSettings(db: DB): Promise<PaymentSettings> {
  const { data } = await db.from("app_settings").select("*").eq("singleton", true).maybeSingle();
  return (data ?? {}) as PaymentSettings;
}

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

function money(n: number, currency: string) {
  return `${currency} ${Number(n).toFixed(2)}`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function paras(s: string) {
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function emailHtml(body: string, opts: {
  headerImageUrl?: string | null;
  signature?: string | null;
  badge?: { text: string; bg: string } | null;
  rows?: Array<[string, string]>;
}) {
  const header = (opts.headerImageUrl ?? "").trim();
  const signature = (opts.signature ?? "— Inovtech Student Attendance").trim();
  const rows = (opts.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:13px;width:150px">${esc(k)}</td><td style="padding:10px 14px;font-size:14px">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:680px">
    ${header ? `<div style="margin-bottom:16px"><img src="${esc(header)}" alt="" style="display:block;max-width:100%;height:auto;border:0" /></div>` : ""}
    ${opts.badge ? `<div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${opts.badge.bg};color:#fff;font-size:12px;font-weight:bold;letter-spacing:.5px;margin:8px 0 16px">${esc(opts.badge.text)}</div>` : ""}
    ${paras(body)}
    ${rows ? `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:520px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">${rows}</table>` : ""}
    <p style="color:#666;font-size:12px;margin-top:24px;white-space:pre-line">${esc(signature)}</p>
  </div>`;
}

/** Load everything needed to message about one invoice. */
export async function loadInvoiceContext(db: DB, invoiceId: string) {
  const { data: inv } = await db.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv) throw new Error("Invoice not found");
  const { data: sp } = await db
    .from("student_payment_plans")
    .select("id, student_id, payment_plan_id, cohort_id")
    .eq("id", inv.student_payment_plan_id)
    .maybeSingle();
  if (!sp) throw new Error("Plan assignment missing");
  const { data: student } = await db
    .from("students")
    .select(
      "id, student_id, full_name, student_email, guardian_email, guardian_name, guardian_phone, guardian_msg_opt_out",
    )
    .eq("id", sp.student_id)
    .maybeSingle();
  if (!student) throw new Error("Student missing");
  const { data: plan } = await db
    .from("payment_plans")
    .select("id, name, currency")
    .eq("id", sp.payment_plan_id)
    .maybeSingle();
  return {
    invoice: inv,
    student,
    planName: (plan?.name ?? "Tuition") as string,
    currency: (plan?.currency ?? "GHS") as string,
  };
}

async function logRow(
  db: DB,
  row: {
    student_id?: string | null;
    student_name?: string | null;
    channel: "email" | "sms" | "whatsapp";
    recipient: string;
    provider: string;
    kind: string;
    invoice_id?: string | null;
    body?: string | null;
    status: "sent" | "failed" | "skipped";
    provider_message_id?: string | null;
    error?: string | null;
  },
) {
  await db.from("notification_log").insert({
    ...row,
    date: new Date().toISOString().slice(0, 10),
    sent_at: row.status === "sent" ? new Date().toISOString() : null,
  });
}

export function publicOrigin() {
  return (
    process.env["PUBLIC_SITE_URL"] ??
    process.env["VITE_PUBLIC_SITE_URL"] ??
    "https://inovtechattendance.lovable.app"
  );
}

type SendResult = {
  kind: string;
  email: Array<{ to: string; ok: boolean; error?: string }>;
  sms: { to: string; ok: boolean; error?: string } | null;
  whatsapp: { to: string; ok: boolean; error?: string } | null;
};

/** Payment received — email with PDF receipt + SMS/WhatsApp confirmation. */
export async function notifyPaymentReceived(
  db: DB,
  paymentId: string,
  settings?: PaymentSettings,
): Promise<SendResult | { skipped: string }> {
  const s = settings ?? (await loadPaymentSettings(db));
  if (s.payment_notify_enabled === false) return { skipped: "payment notifications disabled" };

  const { data: payment } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return { skipped: "payment not found" };
  if (payment.status !== "success") return { skipped: `payment status ${payment.status}` };
  if (!payment.invoice_id) return { skipped: "payment has no invoice" };

  const ctx = await loadInvoiceContext(db, payment.invoice_id);
  const currency = (payment.currency ?? ctx.currency) as string;
  const amount = Number(payment.amount);
  const balance = Number(ctx.invoice.balance_remaining);
  const paidAt = new Date(payment.paid_at);
  const paidAtStr = paidAt.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const vars: Record<string, string> = {
    greeting: `Hello ${ctx.student.full_name},`,
    studentName: ctx.student.full_name,
    studentCode: ctx.student.student_id,
    planName: ctx.planName,
    installment: ctx.invoice.installment_label,
    amount: money(amount, currency),
    balance: money(balance, currency),
    dueDate: ctx.invoice.due_date,
    channel: String(payment.channel),
    paidAt: paidAtStr,
    reference: payment.provider_reference ?? "—",
  };

  const subject = render(s.payment_receipt_subject?.trim() || DEFAULTS.receiptSubject, vars);
  const body = render(s.payment_receipt_body?.trim() || DEFAULTS.receiptBody, vars);
  const receiptNo = `RCPT-${String(payment.id).slice(0, 8).toUpperCase()}`;

  const { buildReceiptPdf } = await import("./receipt-pdf.server");
  const pdf = buildReceiptPdf({
    receiptNo,
    orgName: "Inovtech STEM Center",
    studentName: ctx.student.full_name,
    studentCode: ctx.student.student_id,
    planName: ctx.planName,
    installmentLabel: ctx.invoice.installment_label,
    amount,
    currency,
    channel: String(payment.channel),
    provider: payment.provider,
    reference: payment.provider_reference,
    paidAt: paidAtStr,
    invoiceTotal: Number(ctx.invoice.amount_due),
    balanceRemaining: balance,
  });

  const html = emailHtml(body, {
    headerImageUrl: s.email_header_image_url,
    signature: s.email_signature,
    badge: { text: `PAYMENT RECEIVED • ${money(amount, currency)}`, bg: "#16a34a" },
    rows: [
      ["Receipt no.", receiptNo],
      ["Student", `${ctx.student.full_name} (${ctx.student.student_id})`],
      ["Installment", ctx.invoice.installment_label],
      ["Amount paid", money(amount, currency)],
      ["Balance remaining", money(balance, currency)],
      ["Paid at", paidAtStr],
    ],
  });

  const { sendGmail } = await import("./gmail.server");
  const attachments = [
    {
      filename: `${receiptNo}.pdf`,
      mimeType: "application/pdf",
      base64: pdf.toString("base64"),
    },
  ];

  const out: SendResult = { kind: "receipt", email: [], sms: null, whatsapp: null };
  const recipients = [ctx.student.student_email, ctx.student.guardian_email]
    .map((e) => (e ?? "").trim())
    .filter((e, i, arr) => e && arr.indexOf(e) === i) as string[];

  for (const to of recipients) {
    const res = await sendGmail({ to, subject, html, text: `${body}\n\nReceipt: ${receiptNo}`, attachments });
    out.email.push({ to, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
    await logRow(db, {
      student_id: ctx.student.student_id,
      student_name: ctx.student.full_name,
      channel: "email",
      recipient: to,
      provider: "gmail",
      kind: "payment_receipt",
      invoice_id: ctx.invoice.id,
      body: subject,
      status: res.ok ? "sent" : "failed",
      provider_message_id: res.ok ? res.id : null,
      error: res.ok ? null : res.error,
    });
  }

  await sendGuardianMessages(db, {
    ctx,
    settings: s,
    kind: "payment_receipt",
    smsText: render(s.payment_receipt_sms?.trim() || DEFAULTS.receiptSms, vars),
    whatsappTemplate: s.whatsapp_payment_received_template,
    whatsappParams: [ctx.student.full_name, money(amount, currency), ctx.invoice.installment_label, money(balance, currency)],
    out,
  });

  await db
    .from("invoice_notifications")
    .upsert(
      { invoice_id: ctx.invoice.id, kind: `receipt_${payment.id}`, payment_id: payment.id },
      { onConflict: "invoice_id,kind" },
    );

  return out;
}

async function sendGuardianMessages(
  db: DB,
  args: {
    ctx: Awaited<ReturnType<typeof loadInvoiceContext>>;
    settings: PaymentSettings;
    kind: string;
    smsText: string;
    whatsappTemplate?: string | null;
    whatsappParams: string[];
    out: SendResult;
  },
) {
  const { ctx, settings: s, out } = args;
  if (ctx.student.guardian_msg_opt_out) return;
  const { normalizePhone, sendSms, sendWhatsApp } = await import("./messaging.server");
  const phone = normalizePhone(ctx.student.guardian_phone);
  if (!phone) return;

  if (s.whatsapp_enabled) {
    const r = await sendWhatsApp({
      to: phone,
      message: args.smsText,
      templateName: args.whatsappTemplate ?? null,
      templateLang: s.whatsapp_template_lang ?? "en",
      templateParams: args.whatsappParams,
    });
    const ok = "ok" in r && r.ok;
    out.whatsapp = { to: phone, ok, ...(ok ? {} : { error: "error" in r ? r.error : (r as any).skipped }) };
    await logRow(db, {
      student_id: ctx.student.student_id,
      student_name: ctx.student.full_name,
      channel: "whatsapp",
      recipient: phone,
      provider: "meta",
      kind: args.kind,
      invoice_id: ctx.invoice.id,
      body: args.smsText,
      status: ok ? "sent" : "skipped" in r ? "skipped" : "failed",
      provider_message_id: ok ? (r as any).id : null,
      error: "error" in r ? r.error : "skipped" in r ? (r as any).skipped : null,
    });
    if (ok) return; // WhatsApp first, SMS is the fallback
  }

  if (s.sms_enabled) {
    const r = await sendSms({ to: phone, message: args.smsText, senderId: s.sms_sender_id ?? null });
    const ok = "ok" in r && r.ok;
    out.sms = { to: phone, ok, ...(ok ? {} : { error: "error" in r ? r.error : (r as any).skipped }) };
    const err = "error" in r ? r.error : "skipped" in r ? (r as any).skipped : null;
    await logRow(db, {
      student_id: ctx.student.student_id,
      student_name: ctx.student.full_name,
      channel: "sms",
      recipient: phone,
      provider: "arkesel",
      kind: args.kind,
      invoice_id: ctx.invoice.id,
      body: args.smsText,
      status: ok ? "sent" : "skipped" in r ? "skipped" : "failed",
      provider_message_id: ok ? (r as any).id : null,
      error: err,
    });
    if (!ok && err && /balance|insufficient|credit/i.test(String(err))) {
      await logRow(db, {
        channel: "sms",
        recipient: "admin",
        provider: "arkesel",
        kind: "sms_low_balance_alert",
        invoice_id: ctx.invoice.id,
        body: `Payment notification could not be delivered: ${err}`,
        status: "failed",
        error: String(err),
      });
    }
  }
}

/** Upcoming-due or overdue notice for one invoice. `force` skips de-duplication. */
export async function notifyInvoiceDue(
  db: DB,
  invoiceId: string,
  opts: { kind: string; daysOverdue?: number; force?: boolean; settings?: PaymentSettings },
): Promise<SendResult | { skipped: string }> {
  const s = opts.settings ?? (await loadPaymentSettings(db));
  if (s.payment_notify_enabled === false && !opts.force)
    return { skipped: "payment notifications disabled" };

  const ctx = await loadInvoiceContext(db, invoiceId);
  if (["paid", "waived"].includes(ctx.invoice.status)) return { skipped: "invoice settled" };
  if (Number(ctx.invoice.balance_remaining) <= 0) return { skipped: "nothing outstanding" };

  if (!opts.force) {
    const { data: seen } = await db
      .from("invoice_notifications")
      .select("id")
      .eq("invoice_id", invoiceId)
      .eq("kind", opts.kind)
      .maybeSingle();
    if (seen) return { skipped: `already sent (${opts.kind})` };
  }

  const overdue = (opts.daysOverdue ?? 0) > 0;
  const currency = ctx.currency;
  const payLink = `${publicOrigin().replace(/\/$/, "")}/api/public/checkout/${invoiceId}`;
  const vars: Record<string, string> = {
    greeting: `Hello ${ctx.student.full_name},`,
    studentName: ctx.student.full_name,
    studentCode: ctx.student.student_id,
    planName: ctx.planName,
    installment: ctx.invoice.installment_label,
    balance: money(Number(ctx.invoice.balance_remaining), currency),
    amount: money(Number(ctx.invoice.amount_due), currency),
    dueDate: ctx.invoice.due_date,
    daysOverdue: String(opts.daysOverdue ?? 0),
    payLink,
  };

  const subject = render(
    (overdue ? s.payment_overdue_subject : s.payment_reminder_subject)?.trim() ||
      (overdue ? DEFAULTS.overdueSubject : DEFAULTS.reminderSubject),
    vars,
  );
  const body = render(
    (overdue ? s.payment_overdue_body : s.payment_reminder_body)?.trim() ||
      (overdue ? DEFAULTS.overdueBody : DEFAULTS.reminderBody),
    vars,
  );
  const smsText = render(
    (overdue ? s.payment_overdue_sms : s.payment_reminder_sms)?.trim() ||
      (overdue ? DEFAULTS.overdueSms : DEFAULTS.reminderSms),
    vars,
  ).slice(0, 320);

  const html = emailHtml(body, {
    headerImageUrl: s.email_header_image_url,
    signature: s.email_signature,
    badge: overdue
      ? { text: `OVERDUE • ${vars.balance}`, bg: "#dc2626" }
      : { text: `DUE ${ctx.invoice.due_date} • ${vars.balance}`, bg: "#2563eb" },
    rows: [
      ["Student", `${ctx.student.full_name} (${ctx.student.student_id})`],
      ["Installment", ctx.invoice.installment_label],
      ["Amount outstanding", vars.balance!],
      ["Due date", ctx.invoice.due_date],
      ["Pay online", payLink],
    ],
  });

  const out: SendResult = { kind: opts.kind, email: [], sms: null, whatsapp: null };
  const { sendGmail } = await import("./gmail.server");
  const recipients = [ctx.student.student_email, ctx.student.guardian_email]
    .map((e) => (e ?? "").trim())
    .filter((e, i, arr) => e && arr.indexOf(e) === i) as string[];

  for (const to of recipients) {
    const res = await sendGmail({ to, subject, html, text: body });
    out.email.push({ to, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
    await logRow(db, {
      student_id: ctx.student.student_id,
      student_name: ctx.student.full_name,
      channel: "email",
      recipient: to,
      provider: "gmail",
      kind: overdue ? "payment_overdue" : "payment_reminder",
      invoice_id: invoiceId,
      body: subject,
      status: res.ok ? "sent" : "failed",
      provider_message_id: res.ok ? res.id : null,
      error: res.ok ? null : res.error,
    });
  }

  await sendGuardianMessages(db, {
    ctx,
    settings: s,
    kind: overdue ? "payment_overdue" : "payment_reminder",
    smsText,
    whatsappTemplate: overdue
      ? s.whatsapp_payment_overdue_template
      : s.whatsapp_payment_reminder_template,
    whatsappParams: [
      ctx.student.full_name,
      ctx.invoice.installment_label,
      vars.balance!,
      ctx.invoice.due_date,
    ],
    out,
  });

  await db
    .from("invoice_notifications")
    .upsert({ invoice_id: invoiceId, kind: opts.kind }, { onConflict: "invoice_id,kind" });

  return out;
}

function daysBetween(a: string, b: string) {
  return Math.floor((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

/**
 * Daily cron pass: T-N upcoming reminders plus overdue escalation at the
 * configured cadence checkpoints only (never daily spam).
 */
export async function runPaymentReminderSweep(db: DB) {
  const s = await loadPaymentSettings(db);
  if (s.payment_notify_enabled === false) return { skipped: true, reminders: 0, overdue: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const daysBefore = Number(s.payment_reminder_days_before ?? 3);
  const cadence = (s.payment_overdue_cadence ?? [1, 7, 14]).map(Number);

  const { data: invoices } = await db
    .from("invoices")
    .select("id, due_date, status, balance_remaining")
    .in("status", ["pending", "partial", "overdue"])
    .gt("balance_remaining", 0);

  let reminders = 0;
  let overdue = 0;
  const errors: string[] = [];

  for (const inv of invoices ?? []) {
    const diff = daysBetween(inv.due_date, today); // >0 = upcoming
    try {
      if (diff === daysBefore) {
        const r = await notifyInvoiceDue(db, inv.id, {
          kind: `reminder_t${daysBefore}`,
          settings: s,
        });
        if (!("skipped" in r)) reminders++;
      } else if (diff < 0) {
        const late = -diff;
        if (cadence.includes(late)) {
          const r = await notifyInvoiceDue(db, inv.id, {
            kind: `overdue_${late}`,
            daysOverdue: late,
            settings: s,
          });
          if (!("skipped" in r)) overdue++;
        }
      }
    } catch (err) {
      errors.push(`${inv.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { scanned: (invoices ?? []).length, reminders, overdue, errors };
}
