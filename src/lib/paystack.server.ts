/**
 * Paystack hosted-checkout integration (server-only).
 *
 * Inovtech is a merchant on a licensed rail: all card/momo credentials are
 * entered on Paystack's hosted page. This platform only creates transactions,
 * verifies them, and reconciles the ledger.
 */

type DB = { from: (t: string) => any; rpc: (fn: string, args?: any) => any };

const PAYSTACK_API = "https://api.paystack.co";

export function getPaystackSecret(): string | null {
  return process.env["PAYSTACK_SECRET_KEY"] ?? null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type CheckoutInit = {
  authorization_url: string;
  reference: string;
  amount: number;
  currency: string;
};

/** Load the invoice with its student + currency, for checkout. */
export async function loadInvoiceForCheckout(db: DB, invoiceId: string) {
  const { data: inv } = await db
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "waived") throw new Error("Invoice is waived");
  if (Number(inv.balance_remaining) <= 0) throw new Error("Invoice already paid");

  const { data: sp } = await db
    .from("student_payment_plans")
    .select("id, student_id, payment_plan_id")
    .eq("id", inv.student_payment_plan_id)
    .maybeSingle();
  if (!sp) throw new Error("Plan assignment missing");

  const { data: student } = await db
    .from("students")
    .select("id, student_id, full_name, student_email, guardian_email")
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
    currency: (plan?.currency ?? "GHS") as string,
    planName: (plan?.name ?? "Tuition") as string,
  };
}

/**
 * Initialise a hosted checkout for an invoice's outstanding balance and store
 * an `initiated` payment row so the webhook can reconcile idempotently.
 */
export async function initInvoiceCheckout(
  db: DB,
  invoiceId: string,
  origin: string,
  opts: { amount?: number | null; email?: string | null } = {},
): Promise<CheckoutInit> {
  const secret = getPaystackSecret();
  if (!secret) throw new Error("Paystack is not configured yet");

  const ctx = await loadInvoiceForCheckout(db, invoiceId);
  const balance = round2(Number(ctx.invoice.balance_remaining));
  const amount = round2(Math.min(opts.amount ? Number(opts.amount) : balance, balance));
  if (!(amount > 0)) throw new Error("Nothing to pay on this invoice");

  const email =
    opts.email ??
    ctx.student.student_email ??
    ctx.student.guardian_email ??
    `${String(ctx.student.student_id).toLowerCase()}@no-email.invalid`;

  const reference = `INV-${String(invoiceId).slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      currency: ctx.currency,
      reference,
      callback_url: `${origin}/pay/return`,
      metadata: {
        invoice_id: invoiceId,
        student_id: ctx.student.id,
        student_code: ctx.student.student_id,
        installment: ctx.invoice.installment_label,
        plan: ctx.planName,
      },
    }),
  });
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json?.status || !json?.data?.authorization_url) {
    throw new Error(json?.message ?? `Paystack error (${res.status})`);
  }

  const { error } = await db.from("payments").insert({
    invoice_id: invoiceId,
    student_id: ctx.student.id,
    amount,
    currency: ctx.currency,
    channel: "card",
    provider: "paystack",
    provider_reference: reference,
    status: "initiated",
    paid_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  return {
    authorization_url: json.data.authorization_url as string,
    reference,
    amount,
    currency: ctx.currency,
  };
}

/** HMAC-SHA512 of the raw body with the Paystack secret key. */
export async function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = getPaystackSecret();
  if (!secret || !signature) return false;
  const { createHmac, timingSafeEqual } = await import("crypto");
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Ask Paystack for the authoritative state of a reference. */
export async function fetchTransaction(reference: string) {
  const secret = getPaystackSecret();
  if (!secret) throw new Error("Paystack is not configured yet");
  const res = await fetch(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok || !json?.status) throw new Error(json?.message ?? `Paystack error (${res.status})`);
  return json.data as {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    channel?: string;
    paid_at?: string | null;
    metadata?: Record<string, any> | null;
  };
}

const CHANNEL_MAP: Record<string, string> = {
  card: "card",
  mobile_money: "momo",
  bank: "bank",
  bank_transfer: "bank",
  ussd: "momo",
};

/**
 * Reconcile a successful Paystack transaction into the ledger. Idempotent:
 * a reference already marked `success` is a no-op.
 */
export async function reconcileTransaction(
  db: DB,
  tx: {
    reference: string;
    status: string;
    amount: number;
    currency?: string;
    channel?: string;
    paid_at?: string | null;
    metadata?: Record<string, any> | null;
  },
) {
  const amount = round2(Number(tx.amount) / 100);
  const channel = CHANNEL_MAP[tx.channel ?? "card"] ?? "card";
  const paidAt = tx.paid_at ? new Date(tx.paid_at).toISOString() : new Date().toISOString();

  const { data: existing } = await db
    .from("payments")
    .select("id, status, invoice_id")
    .eq("provider_reference", tx.reference)
    .maybeSingle();

  if (tx.status !== "success") {
    if (existing && existing.status === "initiated") {
      await db.from("payments").update({ status: "failed" }).eq("id", existing.id);
    }
    return { applied: false, status: tx.status };
  }

  if (existing?.status === "success") return { applied: false, status: "already_recorded" };

  let paymentId = existing?.id as string | undefined;
  let invoiceId = (existing?.invoice_id ?? tx.metadata?.["invoice_id"] ?? null) as string | null;

  if (paymentId) {
    const { error } = await db
      .from("payments")
      .update({
        status: "success",
        amount,
        channel,
        paid_at: paidAt,
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
    if (error) throw new Error(error.message);
  } else {
    const studentId = tx.metadata?.["student_id"] as string | undefined;
    if (!studentId || !invoiceId) return { applied: false, status: "unmatched" };
    const { data: row, error } = await db
      .from("payments")
      .insert({
        invoice_id: invoiceId,
        student_id: studentId,
        amount,
        currency: tx.currency ?? "GHS",
        channel,
        provider: "paystack",
        provider_reference: tx.reference,
        status: "success",
        paid_at: paidAt,
        reconciled_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    paymentId = row.id;
  }

  if (invoiceId && paymentId) {
    const { error } = await db.rpc("apply_payment_to_invoice", { _payment_id: paymentId });
    if (error) throw new Error(error.message);
    try {
      const { notifyPaymentReceived } = await import("./payment-notify.server");
      await notifyPaymentReceived(db as never, paymentId);
    } catch {
      /* notification failures must never fail webhook reconciliation */
    }
  }
  return { applied: true, status: "success", amount };
}
