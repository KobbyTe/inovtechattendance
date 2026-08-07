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

/** Admin: send a reminder / overdue notice for one invoice right now. */
export const sendInvoiceReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ invoiceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { notifyInvoiceDue } = await import("./payment-notify.server");
    const { data: inv } = await db
      .from("invoices")
      .select("due_date")
      .eq("id", data.invoiceId)
      .maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const late = inv
      ? Math.floor((Date.parse(today) - Date.parse(inv.due_date)) / 86_400_000)
      : 0;
    const res = await notifyInvoiceDue(db, data.invoiceId, {
      kind: `manual_${Date.now()}`,
      daysOverdue: late > 0 ? late : 0,
      force: true,
    });
    if ("skipped" in res) return { ok: false as const, error: res.skipped };
    const sent = res.email.filter((e) => e.ok).length;
    return {
      ok: true as const,
      emails: sent,
      failed: res.email.filter((e) => !e.ok).map((e) => e.error ?? "failed"),
      sms: res.sms,
      whatsapp: res.whatsapp,
    };
  });

/** Admin: delivery history for one invoice (from the shared notification log). */
export const getInvoiceNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ invoiceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { data: rows } = await db
      .from("notification_log")
      .select("id, channel, recipient, kind, status, error, created_at")
      .eq("invoice_id", data.invoiceId)
      .order("created_at", { ascending: false })
      .limit(30);
    return rows ?? [];
  });

/** Admin: run the reminder/overdue sweep immediately (same logic as the cron). */
export const runPaymentReminderSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context as any);
    const { runPaymentReminderSweep } = await import("./payment-notify.server");
    return await runPaymentReminderSweep(db);
  });
