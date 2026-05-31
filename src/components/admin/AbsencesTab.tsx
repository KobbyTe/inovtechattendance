import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { CalendarX, RefreshCw } from "lucide-react";
import { initials } from "@/lib/attendance";
import type { Cohort, Student } from "@/types";
import { CohortBadge } from "@/components/admin/RosterTab";

interface Absence {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  day_name: string;
  created_at: string;
}

export function AbsencesTab() {
  const [rows, setRows] = useState<Absence[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [running, setRunning] = useState(false);

  async function load() {
    const [{ data: a }, { data: s }, { data: c }] = await Promise.all([
      supabase.from("absences").select("*").order("date", { ascending: false }),
      supabase.from("students").select("*"),
      supabase.from("cohorts").select("*"),
    ]);
    setRows((a ?? []) as Absence[]);
    setStudents((s ?? []) as Student[]);
    setCohorts((c ?? []) as Cohort[]);
  }

  useEffect(() => {
    load();
  }, []);

  const studentById = useMemo(() => new Map(students.map((s) => [s.student_id, s])), [students]);
  const cohortById = useMemo(() => new Map(cohorts.map((c) => [c.id, c])), [cohorts]);

  const grouped = useMemo(() => {
    const m = new Map<string, Absence[]>();
    for (const r of rows) {
      if (!m.has(r.date)) m.set(r.date, []);
      m.get(r.date)!.push(r);
    }
    return Array.from(m.entries());
  }, [rows]);

  async function runCheckNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/public/hooks/absence-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      if (json.skipped) toast.info(`Skipped — ${json.reason}`);
      else toast.success(`Recorded ${json.inserted} absence(s) for ${json.date}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarX className="h-5 w-5 text-primary" /> Absence tracking
          </h2>
          <p className="text-sm text-muted-foreground">
            Runs automatically at 10pm on Wed/Thu/Fri. Students with no clock-in for the day are marked absent.
          </p>
        </div>
        <Button onClick={runCheckNow} disabled={running} variant="outline" className="h-11">
          <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Checking…" : "Run check now"}
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg bg-card border border-border p-6 text-center text-sm text-muted-foreground">
          No absences recorded yet.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, list]) => (
            <div key={date} className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {format(parseISO(date), "EEEE, MMM d, yyyy")}
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                  {list.length} absent
                </span>
              </div>
              <ul className="divide-y divide-border">
                {list.map((r) => {
                  const stu = studentById.get(r.student_id);
                  const cohort = stu?.cohort_id ? cohortById.get(stu.cohort_id) : undefined;
                  return (
                    <li key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-destructive/10 text-destructive font-semibold flex items-center justify-center text-xs">
                        {initials(r.student_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{r.student_name}</p>
                          {cohort && <CohortBadge cohort={cohort} />}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{r.student_id}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}