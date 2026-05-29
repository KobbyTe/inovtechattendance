import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceRecord } from "@/types";
import { formatDuration, formatTime, initials, todayDateStr } from "@/lib/attendance";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format, subDays, parseISO } from "date-fns";

export function DashboardTab() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const since = format(subDays(new Date(), 28), "yyyy-MM-dd");
    supabase
      .from("attendance")
      .select("*")
      .gte("date", since)
      .order("clock_in", { ascending: false })
      .then(({ data }) => setRecords((data ?? []) as AttendanceRecord[]));
  }, []);

  const today = todayDateStr();
  const todayRecs = records.filter((r) => r.date === today);
  const uniqueStudents = new Set(records.map((r) => r.student_id)).size;
  const uniqueDays = new Set(records.map((r) => r.date)).size;

  // Group by date for chart
  const byDate = new Map<string, number>();
  for (let i = 27; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    byDate.set(d, 0);
  }
  for (const r of records) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1);
  }
  const chartData = Array.from(byDate.entries()).map(([date, count]) => ({
    label: format(parseISO(date), "MMM d"),
    count,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Total Sessions" value={records.length} />
        <Metric label="Unique Students" value={uniqueStudents} />
        <Metric label="Meeting Days Logged" value={uniqueDays} />
        <Metric label="Today's Count" value={todayRecs.length} />
      </div>

      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Attendance — last 4 weeks
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Today's sessions</h3>
        {todayRecs.length === 0 ? (
          <div className="rounded-lg bg-card border border-border p-5 text-center text-sm text-muted-foreground">
            Nothing recorded today yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {todayRecs.map((r) => (
              <li
                key={r.id}
                className="rounded-lg bg-card border border-border p-3 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-accent text-primary font-semibold flex items-center justify-center text-xs">
                  {initials(r.student_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.student_name}</p>
                  <p className="text-xs text-muted-foreground">{r.student_id}</p>
                </div>
                <div className="text-right text-xs">
                  <p>
                    {formatTime(r.clock_in)}
                    {r.clock_out ? ` → ${formatTime(r.clock_out)}` : ""}
                  </p>
                  <p className="font-semibold">{formatDuration(r.clock_in, r.clock_out)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}