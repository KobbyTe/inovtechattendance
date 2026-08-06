import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/pay/return")({
  head: () => ({
    meta: [
      { title: "Payment status — Inovtech STEM Center" },
      {
        name: "description",
        content:
          "Confirmation page for Inovtech bootcamp tuition payments made through our secure hosted checkout.",
      },
      { property: "og:title", content: "Payment status — Inovtech STEM Center" },
      {
        property: "og:description",
        content: "Confirmation of your Inovtech bootcamp tuition payment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { reference?: string } =>
    typeof search.reference === "string" ? { reference: search.reference } : {},
  component: PayReturn,
});

type State =
  | { kind: "loading" }
  | { kind: "success"; amount: number; currency: string }
  | { kind: "failed"; message: string };

function PayReturn() {
  const { reference } = Route.useSearch();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!reference) {
      setState({ kind: "failed", message: "Missing payment reference." });
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/checkout-verify?reference=${encodeURIComponent(reference)}`,
        );
        const json = (await res.json()) as any;
        if (!alive) return;
        if (json.status === "success") {
          setState({ kind: "success", amount: json.amount, currency: json.currency });
        } else {
          setState({
            kind: "failed",
            message:
              json.status === "unconfigured"
                ? "Online payments are not enabled yet."
                : "We could not confirm this payment yet. If you were charged, it will reconcile shortly.",
          });
        }
      } catch {
        if (alive) setState({ kind: "failed", message: "Network error while confirming." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [reference]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg">
        {state.kind === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-bold">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hold on while we check with the payment provider.
            </p>
          </>
        )}
        {state.kind === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-2xl font-bold">Payment received</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.currency} {state.amount.toFixed(2)} has been applied to your invoice.
              Reference <span className="font-mono">{reference}</span>.
            </p>
          </>
        )}
        {state.kind === "failed" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Not confirmed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
          </>
        )}
      </div>
    </main>
  );
}
