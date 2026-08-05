import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  assignPaymentPlan,
  createPaymentPlan,
  deletePaymentPlan,
  getCohortLedger,
  listPaymentPlans,
  recordManualPayment,
  runOverdueSweepNow,
  unassignStudentPlan,
  waiveInvoice,
} from "@/lib/invoice-generation.functions";

type Installment = { label: string; due_date: string; amount: string };

const AGING_LABELS: { key: string; label: string }[] = [
  { key: "current", label: "Not due" },
  { key: "0-7", label: "0–7 days" },
  { key: "8-14", label: "8–14 days" },
  { key: "15-30", label: "15–30 days" },
  { key: "30+", label: "30+ days" },
];

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  partial: "bg-accent/25 text-accent-foreground",
  paid: "bg-primary/15 text-primary",
  overdue: "bg-destructive/15 text-destructive",
  waived: "bg-muted text-muted-foreground line-through",
};

function money(n: number, currency = "GHS") {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentsTab() {
  const fetchPlans = useServerFn(listPaymentPlans);
  const fetchLedger = useServerFn(getCohortLedger);
  const createPlan = useServerFn(createPaymentPlan);
  const removePlan = useServerFn(deletePaymentPlan);
  const assign = useServerFn(assignPaymentPlan);
  const unassign = useServerFn(unassignStudentPlan);
  const recordPay = useServerFn(recordManualPayment);
  const waive = useServerFn(waiveInvoice);
  const sweep = useServerFn(runOverdueSweepNow);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [cohortId, setCohortId] = useState<string>("");
  const [ledger, setLedger] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any | null>(null);

  const loadPlans = useCallback(async () => {
    const res = (await fetchPlans()) as any;
    setPlans(res.plans);
    setCohorts(res.cohorts);
    setCohortId((prev) => prev || (res.cohorts[0]?.id ?? ""));
  }, [fetchPlans]);

  const loadLedger = useCallback(
    async (id: string) => {
      if (!id) return;
      const res = (await fetchLedger({ data: { cohortId: id } })) as any;
      setLedger(res);
    },
    [fetchLedger],
  );

  useEffect(() => {
    (async () => {
      try {
        await loadPlans();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load payments");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPlans]);

  useEffect(() => {
    if (cohortId) void loadLedger(cohortId).catch(() => undefined);
  }, [cohortId, loadLedger]);

  const cohortPlans = useMemo(
    () => plans.filter((p) => p.cohort_id === cohortId),
    [plans, cohortId],
  );

  async function refresh() {
    setBusy(true);
    try {
      await loadPlans();
      await loadLedger(cohortId);
    } finally {
      setBusy(false);
    }
  }

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payments…
      </div>
    );
  }

  const summary = ledger?.summary;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Payments
          </h2>
          <p className="text-xs text-muted-foreground">
            Plans, invoices and the shared payment ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              void guard(async () => {
                const r = (await sweep()) as any;
                toast.success(`Overdue sweep: ${r.flagged} invoice(s) flagged`);
                await loadLedger(cohortId);
              })
            }
          >
            <AlertCircle className="h-4 w-4 mr-1" /> Run overdue check
          </Button>
          <Button size="sm" onClick={() => setBuilderOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New plan
          </Button>
        </div>
      </div>

      {/* Cohort selector */}
      <div className="flex flex-wrap gap-2">
        {cohorts.map((c) => (
          <button
            key={c.id}
            onClick={() => setCohortId(c.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
              cohortId === c.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-accent",
            )}
          >
            {c.name}
          </button>
        ))}
        {cohorts.length === 0 && (
          <p className="text-xs text-muted-foreground">Create a cohort first.</p>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Billed", value: summary.billed },
            { label: "Collected", value: summary.collected },
            { label: "Outstanding", value: summary.outstanding },
            { label: "Waived", value: summary.waived },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">
                {s.label}
              </p>
              <p className="mt-1 text-lg font-bold text-foreground tabular-nums">
                {money(s.value, summary.currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Aging */}
      {summary && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-bold text-foreground mb-3">Aging (outstanding balance)</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {AGING_LABELS.map((b) => (
              <div key={b.key} className="rounded-lg bg-muted/50 p-2 text-center">
                <p className="text-[10px] text-muted-foreground font-semibold">{b.label}</p>
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {money(summary.aging?.[b.key] ?? 0, summary.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans for cohort */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        <div className="p-3 flex items-center justify-between">
          <p className="text-xs font-bold text-foreground">Payment plans</p>
          <span className="text-[10px] text-muted-foreground">{cohortPlans.length} plan(s)</span>
        </div>
        {cohortPlans.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">
            No plan for this cohort yet — create one to start invoicing.
          </p>
        )}
        {cohortPlans.map((p) => (
          <div key={p.id} className="p-3 flex flex-wrap items-center gap-2 justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {money(Number(p.total_amount), p.currency)} · {p.installment_count} installment(s) ·{" "}
                {p.assigned_count} student(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    const r = (await assign({
                      data: { planId: p.id, wholeCohort: true },
                    })) as any;
                    toast.success(
                      `Assigned to ${r.assigned} student(s), ${r.invoices} invoice(s) created`,
                    );
                    await refresh();
                  })
                }
              >
                Assign to cohort
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    await removePlan({ data: { planId: p.id } });
                    toast.success("Plan deleted");
                    await refresh();
                  })
                }
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Student ledgers */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        <div className="p-3">
          <p className="text-xs font-bold text-foreground">Student ledgers</p>
        </div>
        {(ledger?.rows ?? []).length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">No students in this cohort.</p>
        )}
        {(ledger?.rows ?? []).map((row: any) => {
          const open = expanded === row.student.id;
          return (
            <div key={row.student.id}>
              <button
                onClick={() => setExpanded(open ? null : row.student.id)}
                className="w-full p-3 flex items-center gap-3 text-left hover:bg-accent/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {row.student.full_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.planName ?? "No plan assigned"} · {row.student.student_id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold tabular-nums text-foreground">
                    {money(row.outstanding, row.currency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">outstanding</p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <div className="px-3 pb-4 space-y-3 bg-muted/20">
                  {/* assign per student */}
                  {!row.studentPlanId && cohortPlans.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {cohortPlans.map((p) => (
                        <Button
                          key={p.id}
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void guard(async () => {
                              await assign({
                                data: { planId: p.id, studentIds: [row.student.id] },
                              });
                              toast.success(`${p.name} assigned`);
                              await refresh();
                            })
                          }
                        >
                          Assign “{p.name}”
                        </Button>
                      ))}
                    </div>
                  )}

                  {row.invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="rounded-lg border border-border bg-card p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {inv.installment_label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Due {format(parseISO(inv.due_date), "d MMM yyyy")} ·{" "}
                            {money(inv.amount_due, row.currency)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            STATUS_TONE[inv.status] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Balance{" "}
                        <span className="font-bold text-foreground tabular-nums">
                          {money(inv.balance_remaining, row.currency)}
                        </span>
                      </p>
                      {inv.payments.length > 0 && (
                        <ul className="space-y-1">
                          {inv.payments.map((p: any) => (
                            <li
                              key={p.id}
                              className="text-[11px] text-muted-foreground flex items-center gap-2"
                            >
                              <BadgeCheck className="h-3 w-3 text-primary" />
                              {money(p.amount, row.currency)} · {p.channel}
                              {p.provider ? ` (${p.provider})` : ""} ·{" "}
                              {format(new Date(p.paid_at), "d MMM yyyy")}
                              {p.overpayment_amount > 0 && (
                                <span className="text-destructive font-semibold">
                                  overpaid {money(Number(p.overpayment_amount), row.currency)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {inv.status !== "paid" && inv.status !== "waived" && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setPayTarget({
                                invoice: inv,
                                studentId: row.student.id,
                                studentName: row.student.full_name,
                                currency: row.currency,
                              })
                            }
                          >
                            <Banknote className="h-4 w-4 mr-1" /> Record payment
                          </Button>
                        )}
                        {inv.status !== "waived" && inv.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void guard(async () => {
                                const reason = window.prompt("Reason for waiving this invoice?");
                                if (!reason || reason.trim().length < 3) return;
                                await waive({ data: { invoiceId: inv.id, reason } });
                                toast.success("Invoice waived");
                                await loadLedger(cohortId);
                              })
                            }
                          >
                            Waive
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {row.studentPlanId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void guard(async () => {
                          await unassign({ data: { studentPlanId: row.studentPlanId } });
                          toast.success("Plan unassigned");
                          await refresh();
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Unassign plan
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PlanBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        cohorts={cohorts}
        defaultCohortId={cohortId}
        onCreate={async (payload) => {
          await createPlan({ data: payload });
          toast.success("Plan created");
          setBuilderOpen(false);
          await refresh();
        }}
      />

      <RecordPaymentSheet
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onSubmit={async (payload) => {
          const r = (await recordPay({ data: payload })) as any;
          if (r.overpayment > 0) {
            toast.warning(
              `Payment recorded — overpayment of ${money(r.overpayment)} logged for review`,
            );
          } else {
            toast.success("Payment recorded");
          }
          setPayTarget(null);
          await loadLedger(cohortId);
        }}
      />
    </div>
  );
}

function PlanBuilder({
  open,
  onOpenChange,
  cohorts,
  defaultCohortId,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cohorts: any[];
  defaultCohortId: string;
  onCreate: (payload: {
    cohortId: string;
    name: string;
    currency: string;
    installments: { label: string; due_date: string; amount: number }[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState("Full payment");
  const [currency, setCurrency] = useState("GHS");
  const [cohort, setCohort] = useState(defaultCohortId);
  const [items, setItems] = useState<Installment[]>([
    { label: "Installment 1", due_date: todayStr(), amount: "" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setCohort(defaultCohortId);
  }, [open, defaultCohortId]);

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New payment plan</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Cohort</Label>
            <select
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Plan name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-2">
            <Label>Installments</Label>
            {items.map((it, idx) => (
              <div key={idx} className="rounded-lg border border-border p-2 space-y-2">
                <Input
                  value={it.label}
                  placeholder="Label"
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)),
                    )
                  }
                />
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={it.due_date}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, due_date: e.target.value } : p)),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={it.amount}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, amount: e.target.value } : p)),
                      )
                    }
                  />
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    label: `Installment ${prev.length + 1}`,
                    due_date: todayStr(),
                    amount: "",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add installment
            </Button>
          </div>

          <p className="text-sm font-bold text-foreground">
            Total: {money(total, currency || "GHS")}
          </p>

          <Button
            className="w-full"
            disabled={saving}
            onClick={async () => {
              if (!cohort) return toast.error("Pick a cohort");
              const installments = items.map((i) => ({
                label: i.label.trim(),
                due_date: i.due_date,
                amount: Number(i.amount),
              }));
              if (installments.some((i) => !i.label || !i.due_date || !(i.amount > 0)))
                return toast.error("Every installment needs a label, date and amount");
              setSaving(true);
              try {
                await onCreate({ cohortId: cohort, name: name.trim(), currency, installments });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to create plan");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create plan"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RecordPaymentSheet({
  target,
  onClose,
  onSubmit,
}: {
  target: any | null;
  onClose: () => void;
  onSubmit: (payload: {
    studentId: string;
    invoiceId: string;
    amount: number;
    channel: "cash" | "manual" | "bank" | "momo";
    paidAt: string;
    note?: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<"cash" | "manual" | "bank" | "momo">("cash");
  const [paidAt, setPaidAt] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setAmount(String(target.invoice.balance_remaining ?? ""));
      setChannel("cash");
      setPaidAt(todayStr());
      setNote("");
    }
  }, [target]);

  return (
    <Sheet open={!!target} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Record payment</SheetTitle>
        </SheetHeader>
        {target && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-semibold text-foreground">{target.studentName}</p>
              <p className="text-[11px] text-muted-foreground">
                {target.invoice.installment_label} · balance{" "}
                {money(target.invoice.balance_remaining, target.currency)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="momo">Mobile money (manual)</option>
                <option value="bank">Bank transfer</option>
                <option value="manual">Other / manual</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date paid</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
            <Button
              className="w-full"
              disabled={saving}
              onClick={async () => {
                const value = Number(amount);
                if (!(value > 0)) return toast.error("Enter an amount");
                setSaving(true);
                try {
                  await onSubmit({
                    studentId: target.studentId,
                    invoiceId: target.invoice.id,
                    amount: value,
                    channel,
                    paidAt,
                    note: note.trim() || undefined,
                  });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to record payment");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save payment"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}