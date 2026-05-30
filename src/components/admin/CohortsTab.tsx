import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Cohort } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { computeEndDate, generateCohortCode, pickCohortColor } from "@/lib/cohorts";
import { format, parseISO } from "date-fns";

type CohortForm = {
  id?: string;
  name: string;
  is_ongoing: boolean;
  duration_weeks: string;
  start_date: string;
  color: string;
};

const emptyForm = (color: string): CohortForm => ({
  name: "",
  is_ongoing: false,
  duration_weeks: "12",
  start_date: format(new Date(), "yyyy-MM-dd"),
  color,
});

export function CohortsTab() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CohortForm>(emptyForm(pickCohortColor(0)));
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: cs }, { data: ss }] = await Promise.all([
      supabase.from("cohorts").select("*").order("created_at", { ascending: true }),
      supabase.from("students").select("cohort_id"),
    ]);
    setCohorts((cs ?? []) as Cohort[]);
    const c: Record<string, number> = {};
    for (const r of ss ?? []) {
      const cid = (r as { cohort_id: string | null }).cohort_id;
      if (cid) c[cid] = (c[cid] ?? 0) + 1;
    }
    setCounts(c);
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(emptyForm(pickCohortColor(cohorts.length)));
    setOpen(true);
  }

  function openEdit(c: Cohort) {
    setForm({
      id: c.id,
      name: c.name,
      is_ongoing: c.is_ongoing,
      duration_weeks: c.duration_weeks?.toString() ?? "",
      start_date: c.start_date ?? format(new Date(), "yyyy-MM-dd"),
      color: c.color,
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    setBusy(true);
    const code = generateCohortCode(form.name);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      code,
      is_ongoing: form.is_ongoing,
      color: form.color,
    };
    if (form.is_ongoing) {
      payload.duration_weeks = null;
      payload.start_date = null;
      payload.end_date = null;
    } else {
      const weeks = parseInt(form.duration_weeks, 10);
      if (!weeks || weeks < 1) {
        setBusy(false);
        return toast.error("Enter a valid duration in weeks");
      }
      payload.duration_weeks = weeks;
      payload.start_date = form.start_date;
      payload.end_date = computeEndDate(form.start_date, weeks);
    }

    const { error } = form.id
      ? await supabase.from("cohorts").update(payload).eq("id", form.id)
      : await supabase.from("cohorts").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "Cohort name/code already exists" : error.message);
      return;
    }
    toast.success(form.id ? "Cohort updated" : "Cohort added");
    setOpen(false);
    load();
  }

  async function remove(c: Cohort) {
    if ((counts[c.id] ?? 0) > 0) {
      toast.error(`Cannot delete — ${counts[c.id]} student(s) still assigned to this cohort.`);
      return;
    }
    const { error } = await supabase.from("cohorts").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Cohort removed");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cohorts</h2>
          <p className="text-sm text-muted-foreground">Group students by class or program.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button onClick={openNew} className="h-11">
              <Plus className="mr-1 h-4 w-4" /> Add cohort
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{form.id ? "Edit cohort" : "Add a cohort"}</SheetTitle>
            </SheetHeader>
            <form onSubmit={submit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Cohort name</Label>
                <Input
                  required
                  placeholder="Saturday Class"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {form.name && (
                  <p className="text-xs text-muted-foreground">
                    Auto code: <span className="font-mono font-semibold">{generateCohortCode(form.name)}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm">Ongoing (no end date)</Label>
                  <p className="text-xs text-muted-foreground">
                    Use for Saturday Class and similar recurring cohorts.
                  </p>
                </div>
                <Switch
                  checked={form.is_ongoing}
                  onCheckedChange={(v) => setForm({ ...form, is_ongoing: v })}
                />
              </div>

              {!form.is_ongoing ? (
                <>
                  <div className="space-y-2">
                    <Label>Duration (weeks)</Label>
                    <Input
                      type="number"
                      min={1}
                      required
                      value={form.duration_weeks}
                      onChange={(e) => setForm({ ...form, duration_weeks: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  {form.duration_weeks && form.start_date && (
                    <p className="text-xs text-muted-foreground">
                      End date (auto):{" "}
                      <span className="font-semibold">
                        {format(
                          parseISO(computeEndDate(form.start_date, parseInt(form.duration_weeks, 10) || 0)),
                          "MMM d, yyyy"
                        )}
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground rounded-md bg-muted p-3">
                  This cohort has no fixed end date.
                </p>
              )}

              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-11 w-24 p-1"
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full h-11">
                {busy ? "Saving…" : form.id ? "Save changes" : "Add cohort"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {cohorts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No cohorts yet. Add your first one.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cohorts.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: c.color }}
                    />
                    <h3 className="font-semibold truncate">{c.name}</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground font-mono">{c.code}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {c.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. Cohorts with students assigned cannot be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(c)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="font-medium">
                    {c.is_ongoing ? "Ongoing" : `${c.duration_weeks} weeks`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Students</dt>
                  <dd className="font-medium">{counts[c.id] ?? 0}</dd>
                </div>
                {c.start_date && (
                  <div>
                    <dt className="text-muted-foreground">Start</dt>
                    <dd className="font-medium">{format(parseISO(c.start_date), "MMM d, yyyy")}</dd>
                  </div>
                )}
                {c.end_date && (
                  <div>
                    <dt className="text-muted-foreground">End</dt>
                    <dd className="font-medium">{format(parseISO(c.end_date), "MMM d, yyyy")}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}