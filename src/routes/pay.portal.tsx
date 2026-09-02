import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CreditCard, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { getPortalInvoices } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pay/portal")({
  head: () => ({
    meta: [
      { title: "My tuition — Inovtech STEM Center" },
      {
        name: "description",
        content:
          "Secure self-service page for Inovtech bootcamp students and guardians to view tuition installments and pay outstanding balances.",
      },
      { property: "og:title", content: "My tuition — Inovtech STEM Center" },
      {
        property: "og:description",
        content: "View your Inovtech tuition installments and pay any outstanding balance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === "string" ? { token: search.token } : {},
  component: PortalPage,
});

type Data = Awaited<ReturnType<typeof getPortalInvoices>>;

const money = (n: number, c: string) =>
  `${c} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusTone: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-600",
  partial: "bg-amber-500/15 text-amber-600",
  overdue: "bg-destructive/15 text-destructive",
  waived: "bg-muted text-muted-foreground",
  pending: "bg-primary/10 text-primary",
};

function PortalPage() {
  const { token } = Route.useSearch();
  const load = useServerFn(getPortalInvoices);
  const [state, setState] = useState<Data | { ok: false; error: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) {
      setState({ ok: false, error: "This payment link is incomplete." });
      return;
    }
    try {
      setState(await load({ data: { token } }));
    } catch {
      setState({ ok: false, error: "We could not load your tuition details." });
    }
  }, [load, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (!state) {
    return (
      <main className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your tuition…
        </span>
      </main>
    );
  }

  if (!state.ok) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <XCircle className="h-10 w-10 mx-auto text-destructive" />
          <h1 className="text-lg font-bold">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">{state.error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Inovtech STEM Center
          </p>
          <h1 className="text-2xl font-black">{state.studentName}</h1>
          <p className="text-xs text-muted-foreground">Student ID {state.studentCode}</p>
        </header>

        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Billed", value: state.billed },
            { label: "Paid", value: state.paid },
            { label: "Outstanding", value: state.outstanding },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-sm font-bold">{money(s.value, state.currency)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border bg-card divide-y">
          {state.invoices.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No tuition installments have been issued yet.
            </p>
          )}
          {state.invoices.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{inv.label}</p>
                <p className="text-xs text-muted-foreground">
                  Due {format(parseISO(inv.dueDate), "d MMM yyyy")} ·{" "}
                  {money(inv.amountDue, state.currency)}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                  statusTone[inv.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {inv.status}
              </span>
              {inv.balance > 0 && inv.status !== "waived" ? (
                <Button size="sm" asChild>
                  <a href={`/api/public/checkout/${inv.id}`}>
                    <CreditCard className="h-4 w-4 mr-1" />
                    Pay {money(inv.balance, state.currency)}
                  </a>
                </Button>
              ) : null}
            </div>
          ))}
        </section>

        <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Payments are processed on a secure hosted
          checkout. We never store your card details.
        </p>
      </div>
    </main>
  );
}
