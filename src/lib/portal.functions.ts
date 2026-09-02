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

/** Admin: build a shareable, signed self-service portal link for a student. */
export const getStudentPortalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ studentId: z.string().uuid(), origin: z.string().url() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { data: student } = await db
      .from("students")
      .select("student_id, full_name")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");
    const { signPortalToken } = await import("./portal-token.server");
    const token = signPortalToken(student.student_id);
    return {
      url: `${data.origin.replace(/\/$/, "")}/pay/portal?token=${encodeURIComponent(token)}`,
      studentName: student.full_name as string,
    };
  });

/**
 * Public: read one student's invoice list from a signed portal token.
 * Exposes only the payer-facing fields — no contact details, no other student.
 */
export const getPortalInvoices = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().min(8).max(400) }).parse(i))
  .handler(async ({ data }) => {
    const { verifyPortalToken } = await import("./portal-token.server");
    const check = verifyPortalToken(data.token);
    if (!check.valid || !check.studentId) {
      return { ok: false as const, error: check.reason ?? "Invalid link" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: student } = await db
      .from("students")
      .select("id, student_id, full_name")
      .eq("student_id", check.studentId)
      .maybeSingle();
    if (!student) return { ok: false as const, error: "Invalid link" };

    const { data: plans } = await db
      .from("student_payment_plans")
      .select("id, payment_plan_id")
      .eq("student_id", student.id);
    const planIds = (plans ?? []).map((p: any) => p.id);

    const invoices = planIds.length
      ? ((
          await db
            .from("invoices")
            .select(
              "id, installment_label, amount_due, balance_remaining, due_date, status",
            )
            .in("student_payment_plan_id", planIds)
            .order("due_date", { ascending: true })
        ).data ?? [])
      : [];

    let currency = "GHS";
    if ((plans ?? []).length > 0) {
      const { data: plan } = await db
        .from("payment_plans")
        .select("currency, name")
        .eq("id", plans[0].payment_plan_id)
        .maybeSingle();
      if (plan?.currency) currency = plan.currency;
    }

    const rows = (invoices ?? []).map((i: any) => ({
      id: i.id as string,
      label: i.installment_label as string,
      amountDue: Number(i.amount_due),
      balance: Number(i.balance_remaining),
      dueDate: i.due_date as string,
      status: i.status as string,
    }));

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const billed = round2(
      rows.filter((r) => r.status !== "waived").reduce((s, r) => s + r.amountDue, 0),
    );
    const outstanding = round2(
      rows.filter((r) => r.status !== "waived").reduce((s, r) => s + r.balance, 0),
    );

    return {
      ok: true as const,
      studentName: student.full_name as string,
      studentCode: student.student_id as string,
      currency,
      billed,
      paid: round2(billed - outstanding),
      outstanding,
      invoices: rows,
    };
  });
