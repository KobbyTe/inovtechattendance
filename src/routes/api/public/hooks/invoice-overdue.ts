import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Daily cron: flip due, unpaid invoices to overdue. */
export const Route = createFileRoute("/api/public/hooks/invoice-overdue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret =
          process.env["COHORT_CRON_SECRET"] ?? process.env["RFID_WEBHOOK_SECRET"];
        if (!secret)
          return Response.json({ ok: false, error: "misconfigured" }, { status: 500 });

        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("x-signature"), secret)) {
          return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runOverdueSweep } = await import("@/lib/payments.server");
        try {
          const result = await runOverdueSweep(supabaseAdmin as never);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});