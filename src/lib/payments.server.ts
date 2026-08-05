/**
 * Server-only payments/ledger helpers. Never imported from the client.
 * Money math lives here (and in the SQL function apply_payment_to_invoice)
 * so cash and provider payments share one code path.
 */

type DB = { from: (t: string) => any; rpc: (fn: string, args?: any) => any };

export type InstallmentEntry = { label: string; due_date: string; amount: number };

export function todayISO() {
  return new Date(new Date().toISOString()).toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Create one invoice per installment for a student_payment_plans row. */
export async function generateInvoicesForStudentPlan(
  db: DB,
  studentPlanId: string,
  schedule: InstallmentEntry[],
) {
  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("student_payment_plan_id", studentPlanId);
  if ((existing ?? []).length > 0) return { created: 0 };

  const rows = schedule.map((s) => ({
    student_payment_plan_id: studentPlanId,
    installment_label: s.label,
    amount_due: round2(Number(s.amount)),
    due_date: s.due_date,
    balance_remaining: round2(Number(s.amount)),
    status: "pending",
  }));
  if (rows.length === 0) return { created: 0 };
  const { error } = await db.from("invoices").insert(rows);
  if (error) throw new Error(error.message);
  return { created: rows.length };
}

/**
 * Insert a payment and re-derive the linked invoice balance/status atomically
 * in the DB function. Shared by manual/cash entries and provider webhooks.
 */
export async function recordPayment(
  db: DB,
  input: {
    studentId: string;
    invoiceId?: string | null;
    amount: number;
    currency?: string;
    channel: "momo" | "card" | "bank" | "cash" | "manual";
    provider?: string | null;
    providerReference?: string | null;
    status?: "initiated" | "success" | "failed" | "refunded";
    recordedBy?: string | null;
    paidAt?: string | null;
    note?: string | null;
  },
) {
  const { data: payment, error } = await db
    .from("payments")
    .insert({
      student_id: input.studentId,
      invoice_id: input.invoiceId ?? null,
      amount: round2(Number(input.amount)),
      currency: input.currency ?? "GHS",
      channel: input.channel,
      provider: input.provider ?? null,
      provider_reference: input.providerReference ?? null,
      status: input.status ?? "success",
      recorded_by: input.recordedBy ?? null,
      paid_at: input.paidAt ?? new Date().toISOString(),
      note: input.note ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if ((input.status ?? "success") === "success" && input.invoiceId) {
    const { error: rErr } = await db.rpc("apply_payment_to_invoice", {
      _payment_id: payment.id,
    });
    if (rErr) throw new Error(rErr.message);
  }

  const { data: fresh } = await db
    .from("payments")
    .select("*")
    .eq("id", payment.id)
    .maybeSingle();
  return fresh ?? payment;
}

/** Daily sweep: pending/partial invoices past due become overdue. */
export async function runOverdueSweep(db: DB) {
  const { data, error } = await db.rpc("mark_overdue_invoices");
  if (error) throw new Error(error.message);
  return { flagged: Number(data ?? 0) };
}

export function agingBucket(dueDate: string, today = todayISO()) {
  const days = Math.floor(
    (Date.parse(today) - Date.parse(dueDate)) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "current";
  if (days <= 7) return "0-7";
  if (days <= 14) return "8-14";
  if (days <= 30) return "15-30";
  return "30+";
}

export type CohortFinanceSummary = {
  currency: string;
  billed: number;
  collected: number;
  outstanding: number;
  waived: number;
  aging: Record<string, number>;
  studentsOnPlan: number;
};

/** Cohort-level collected vs outstanding plus aging buckets. */
export async function buildCohortSummary(
  db: DB,
  cohortId: string,
): Promise<CohortFinanceSummary> {
  const { data: plans } = await db
    .from("student_payment_plans")
    .select("id, student_id, status")
    .eq("cohort_id", cohortId);
  const planIds = (plans ?? []).map((p: any) => p.id);

  const invoices: any[] = planIds.length
    ? ((
        await db
          .from("invoices")
          .select("id, amount_due, balance_remaining, status, due_date")
          .in("student_payment_plan_id", planIds)
      ).data ?? [])
    : [];

  const invoiceIds = invoices.map((i) => i.id);
  const payments: any[] = invoiceIds.length
    ? ((
        await db
          .from("payments")
          .select("amount, status, invoice_id")
          .in("invoice_id", invoiceIds)
      ).data ?? [])
    : [];

  const today = todayISO();
  const aging: Record<string, number> = { "current": 0, "0-7": 0, "8-14": 0, "15-30": 0, "30+": 0 };
  let billed = 0;
  let waived = 0;
  let outstanding = 0;
  for (const inv of invoices) {
    const due = Number(inv.amount_due);
    if (inv.status === "waived") {
      waived += due;
      continue;
    }
    billed += due;
    const bal = Number(inv.balance_remaining);
    outstanding += bal;
    if (bal > 0) {
      const bucket = agingBucket(inv.due_date, today);
      aging[bucket] = round2((aging[bucket] ?? 0) + bal);
    }
  }
  const collected = payments
    .filter((p) => p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);

  return {
    currency: "GHS",
    billed: round2(billed),
    collected: round2(collected),
    outstanding: round2(outstanding),
    waived: round2(waived),
    aging,
    studentsOnPlan: (plans ?? []).length,
  };
}