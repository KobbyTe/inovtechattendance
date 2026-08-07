import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const installmentSchema = z.object({
  label: z.string().trim().min(1).max(80),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive().max(1_000_000),
});

/** Admin: list payment plans (with cohort name and assignment count). */
export const listPaymentPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context as any);
    const { data: plans } = await db
      .from("payment_plans")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: cohorts } = await db.from("cohorts").select("id, name, code, color");
    const { data: assigned } = await db
      .from("student_payment_plans")
      .select("payment_plan_id");
    const counts = new Map<string, number>();
    for (const a of assigned ?? [])
      counts.set(a.payment_plan_id, (counts.get(a.payment_plan_id) ?? 0) + 1);
    return {
      plans: (plans ?? []).map((p: any) => ({
        ...p,
        total_amount: Number(p.total_amount),
        assigned_count: counts.get(p.id) ?? 0,
        cohort: (cohorts ?? []).find((c: any) => c.id === p.cohort_id) ?? null,
      })),
      cohorts: cohorts ?? [],
    };
  });

/** Admin: create a payment plan for a cohort. */
export const createPaymentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        cohortId: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
        currency: z.string().trim().length(3).default("GHS"),
        installments: z.array(installmentSchema).min(1).max(24),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const total = data.installments.reduce((s, i) => s + i.amount, 0);
    const { data: plan, error } = await db
      .from("payment_plans")
      .insert({
        cohort_id: data.cohortId,
        name: data.name,
        currency: data.currency.toUpperCase(),
        total_amount: Math.round(total * 100) / 100,
        installment_count: data.installments.length,
        installment_schedule: data.installments,
        created_by: (context as any).userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return plan;
  });

/** Admin: delete a plan that has no assignments yet. */
export const deletePaymentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ planId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { data: assigned } = await db
      .from("student_payment_plans")
      .select("id")
      .eq("payment_plan_id", data.planId)
      .limit(1);
    if ((assigned ?? []).length > 0)
      throw new Error("Plan is assigned to students — unassign first.");
    const { error } = await db.from("payment_plans").delete().eq("id", data.planId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Admin: assign a plan to specific students, or every student in the plan's
 * cohort. Generates the invoice schedule for each new assignment.
 */
export const assignPaymentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        planId: z.string().uuid(),
        studentIds: z.array(z.string().uuid()).max(500).optional(),
        wholeCohort: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { generateInvoicesForStudentPlan } = await import("./payments.server");

    const { data: plan } = await db
      .from("payment_plans")
      .select("*")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) throw new Error("Plan not found");

    let ids = data.studentIds ?? [];
    if (data.wholeCohort) {
      const { data: students } = await db
        .from("students")
        .select("id")
        .eq("cohort_id", plan.cohort_id);
      ids = (students ?? []).map((s: any) => s.id);
    }
    if (ids.length === 0) throw new Error("No students selected");

    let assigned = 0;
    let invoices = 0;
    let skipped = 0;
    for (const studentId of ids) {
      const { data: existing } = await db
        .from("student_payment_plans")
        .select("id")
        .eq("student_id", studentId)
        .eq("payment_plan_id", data.planId)
        .maybeSingle();
      let planRowId = existing?.id as string | undefined;
      if (planRowId) {
        skipped++;
      } else {
        const { data: row, error } = await db
          .from("student_payment_plans")
          .insert({
            student_id: studentId,
            payment_plan_id: data.planId,
            cohort_id: plan.cohort_id,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        planRowId = row.id;
        assigned++;
      }
      const res = await generateInvoicesForStudentPlan(
        db,
        planRowId!,
        (plan.installment_schedule ?? []) as any,
      );
      invoices += res.created;
    }
    return { assigned, skipped, invoices };
  });

/** Admin: remove a student's plan assignment (and its unpaid invoices). */
export const unassignStudentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ studentPlanId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { data: invs } = await db
      .from("invoices")
      .select("id")
      .eq("student_payment_plan_id", data.studentPlanId);
    const ids = (invs ?? []).map((i: any) => i.id);
    if (ids.length) {
      const { data: pays } = await db
        .from("payments")
        .select("id")
        .in("invoice_id", ids)
        .eq("status", "success")
        .limit(1);
      if ((pays ?? []).length > 0)
        throw new Error("Payments exist against this plan — cannot unassign.");
    }
    const { error } = await db
      .from("student_payment_plans")
      .delete()
      .eq("id", data.studentPlanId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: full ledger for one cohort — students, plans, invoices, payments. */
export const getCohortLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ cohortId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { buildCohortSummary, agingBucket } = await import("./payments.server");

    const { data: students } = await db
      .from("students")
      .select("id, student_id, full_name, student_email, guardian_email")
      .eq("cohort_id", data.cohortId)
      .order("full_name");
    const { data: plans } = await db
      .from("student_payment_plans")
      .select("id, student_id, payment_plan_id, status, enrolled_at")
      .eq("cohort_id", data.cohortId);
    const planIds = (plans ?? []).map((p: any) => p.id);
    const { data: planDefs } = await db
      .from("payment_plans")
      .select("id, name, currency, total_amount")
      .eq("cohort_id", data.cohortId);

    const invoices: any[] = planIds.length
      ? ((
          await db
            .from("invoices")
            .select("*")
            .in("student_payment_plan_id", planIds)
            .order("due_date")
        ).data ?? [])
      : [];
    const invoiceIds = invoices.map((i) => i.id);
    const payments: any[] = invoiceIds.length
      ? ((
          await db
            .from("payments")
            .select("*")
            .in("invoice_id", invoiceIds)
            .order("paid_at", { ascending: false })
        ).data ?? [])
      : [];

    const rows = (students ?? []).map((s: any) => {
      const sp = (plans ?? []).find((p: any) => p.student_id === s.id) ?? null;
      const def = sp
        ? ((planDefs ?? []).find((d: any) => d.id === sp.payment_plan_id) ?? null)
        : null;
      const invs = sp
        ? invoices
            .filter((i) => i.student_payment_plan_id === sp.id)
            .map((i) => ({
              ...i,
              amount_due: Number(i.amount_due),
              balance_remaining: Number(i.balance_remaining),
              aging: agingBucket(i.due_date),
              payments: payments
                .filter((p) => p.invoice_id === i.id)
                .map((p) => ({ ...p, amount: Number(p.amount) })),
            }))
        : [];
      const outstanding = invs
        .filter((i) => i.status !== "waived")
        .reduce((t, i) => t + i.balance_remaining, 0);
      const paid = invs.reduce(
        (t, i) =>
          t +
          i.payments
            .filter((p: any) => p.status === "success")
            .reduce((x: number, p: any) => x + p.amount, 0),
        0,
      );
      return {
        student: s,
        studentPlanId: sp?.id ?? null,
        planStatus: sp?.status ?? null,
        planName: def?.name ?? null,
        currency: def?.currency ?? "GHS",
        invoices: invs,
        outstanding: Math.round(outstanding * 100) / 100,
        paid: Math.round(paid * 100) / 100,
      };
    });

    const summary = await buildCohortSummary(db, data.cohortId);
    return { rows, summary, plans: planDefs ?? [] };
  });

/** Admin: record a cash/manual/bank/momo payment against an invoice. */
export const recordManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        studentId: z.string().uuid(),
        invoiceId: z.string().uuid().nullable().optional(),
        amount: z.number().positive().max(1_000_000),
        channel: z.enum(["cash", "manual", "bank", "momo"]).default("cash"),
        paidAt: z.string().min(4),
        note: z.string().trim().max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { recordPayment } = await import("./payments.server");
    const payment = await recordPayment(db, {
      studentId: data.studentId,
      invoiceId: data.invoiceId ?? null,
      amount: data.amount,
      channel: data.channel,
      status: "success",
      recordedBy: (context as any).userId,
      paidAt: new Date(data.paidAt).toISOString(),
      note: data.note ?? null,
    });
    // Payment-received notification (same path as the Paystack webhook).
    let notified = false;
    if (payment?.id && data.invoiceId) {
      try {
        const { notifyPaymentReceived } = await import("./payment-notify.server");
        const res = await notifyPaymentReceived(db, payment.id);
        notified = !("skipped" in res);
      } catch {
        /* never fail a recorded payment because a notification failed */
      }
    }
    return {
      ok: true,
      overpayment: Number(payment.overpayment_amount ?? 0),
      notified,
    };
  });

/** Admin: waive an invoice (attributable, with a reason). */
export const waiveInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        invoiceId: z.string().uuid(),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { error } = await db
      .from("invoices")
      .update({
        status: "waived",
        balance_remaining: 0,
        waived_by: (context as any).userId,
        waived_reason: data.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.invoiceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: run the overdue sweep immediately (same logic as the daily cron). */
export const runOverdueSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context as any);
    const { runOverdueSweep } = await import("./payments.server");
    return await runOverdueSweep(db);
  });