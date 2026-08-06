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

/** Admin: is the Paystack rail configured? */
export const getPaystackStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { getPaystackSecret } = await import("./paystack.server");
    return { configured: Boolean(getPaystackSecret()) };
  });

/**
 * Admin: build a shareable checkout link for an invoice. The link is a public
 * redirect endpoint, so it can be pasted into SMS/WhatsApp/email safely — it
 * initialises the Paystack transaction at click time.
 */
export const getInvoicePaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ invoiceId: z.string().uuid(), origin: z.string().url() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { loadInvoiceForCheckout, getPaystackSecret } = await import("./paystack.server");
    const ctx = await loadInvoiceForCheckout(db, data.invoiceId);
    return {
      url: `${data.origin.replace(/\/$/, "")}/api/public/checkout/${data.invoiceId}`,
      amount: Number(ctx.invoice.balance_remaining),
      currency: ctx.currency,
      configured: Boolean(getPaystackSecret()),
    };
  });

/** Admin: re-verify a reference with Paystack and reconcile if it succeeded. */
export const reconcilePaystackReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ reference: z.string().trim().min(4).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as any);
    const { fetchTransaction, reconcileTransaction } = await import("./paystack.server");
    const tx = await fetchTransaction(data.reference);
    return await reconcileTransaction(db, tx);
  });
