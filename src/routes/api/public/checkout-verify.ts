import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Public: confirm a checkout after redirect back (belt-and-braces vs webhook). */
export const Route = createFileRoute("/api/public/checkout-verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reference = new URL(request.url).searchParams.get("reference") ?? "";
        const parsed = z.string().trim().min(4).max(120).safeParse(reference);
        if (!parsed.success) return Response.json({ status: "invalid" }, { status: 400 });

        const { fetchTransaction, reconcileTransaction, getPaystackSecret } = await import(
          "@/lib/paystack.server"
        );
        if (!getPaystackSecret()) return Response.json({ status: "unconfigured" }, { status: 503 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const tx = await fetchTransaction(parsed.data);
          const result = await reconcileTransaction(supabaseAdmin as never, tx);
          return Response.json({
            status: tx.status,
            amount: Number(tx.amount ?? 0) / 100,
            currency: tx.currency ?? "GHS",
            applied: result.applied,
          });
        } catch {
          return Response.json({ status: "error" }, { status: 500 });
        }
      },
    },
  },
});
