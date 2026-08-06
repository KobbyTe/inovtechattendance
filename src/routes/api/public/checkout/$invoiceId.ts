import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Public pay link: initialises a Paystack hosted checkout for one invoice and
 * redirects the payer to it. Returns no personal data.
 */
export const Route = createFileRoute("/api/public/checkout/$invoiceId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const parsed = z.string().uuid().safeParse(params.invoiceId);
        if (!parsed.success) return new Response("Invalid link", { status: 400 });

        const { initInvoiceCheckout, getPaystackSecret } = await import(
          "@/lib/paystack.server"
        );
        if (!getPaystackSecret()) {
          return new Response("Online payments are not enabled yet.", { status: 503 });
        }

        const origin = new URL(request.url).origin;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const init = await initInvoiceCheckout(supabaseAdmin as never, parsed.data, origin);
          return new Response(null, { status: 302, headers: { Location: init.authorization_url } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Checkout unavailable";
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
