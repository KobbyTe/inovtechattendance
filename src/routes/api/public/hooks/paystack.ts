import { createFileRoute } from "@tanstack/react-router";

/** Paystack webhook: reconcile charge.success into the ledger (idempotent). */
export const Route = createFileRoute("/api/public/hooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { verifyPaystackSignature, reconcileTransaction } = await import(
          "@/lib/paystack.server"
        );
        const ok = await verifyPaystackSignature(
          rawBody,
          request.headers.get("x-paystack-signature"),
        );
        if (!ok) return Response.json({ ok: false }, { status: 401 });

        let event: any;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }

        const kind = String(event?.event ?? "");
        if (!["charge.success", "charge.failed"].includes(kind)) {
          return Response.json({ ok: true, ignored: kind });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const result = await reconcileTransaction(supabaseAdmin as never, {
            reference: String(event.data?.reference ?? ""),
            status: kind === "charge.success" ? "success" : "failed",
            amount: Number(event.data?.amount ?? 0),
            currency: event.data?.currency,
            channel: event.data?.channel,
            paid_at: event.data?.paid_at ?? event.data?.paidAt ?? null,
            metadata: event.data?.metadata ?? null,
          });
          return Response.json({ ok: true, ...result });
        } catch {
          return Response.json({ ok: false, error: "reconcile_failed" }, { status: 500 });
        }
      },
    },
  },
});
