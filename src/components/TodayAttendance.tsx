import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceRecord } from "@/types";
import { formatDuration, formatTime, initials, todayDateStr } from "@/lib/attendance";
import { Clock } from "lucide-react";

export function TodayAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const today = todayDateStr();

    const load = async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today)
        .order("clock_in", { ascending: false });
      setRecords((data ?? []) as AttendanceRecord[]);
    };
    load();

    const channel = supabase
      .channel("attendance-today")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Today's Attendance
      </h2>
      {records.length === 0 ? (
        <div className="rounded-lg bg-card border border-border p-6 text-center text-sm text-muted-foreground">
          No one has clocked in yet today.
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="rounded-lg bg-card border border-border p-3 flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-accent text-primary font-semibold flex items-center justify-center text-sm shrink-0">
                {initials(r.student_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{r.student_name}</p>
                <p className="text-xs text-muted-foreground">{r.student_id}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                  <Clock className="h-3 w-3" />
                  {formatTime(r.clock_in)}
                  {r.clock_out ? ` → ${formatTime(r.clock_out)}` : ""}
                </div>
                <p
                  className={`text-xs font-semibold ${
                    r.clock_out ? "text-foreground" : "text-secondary"
                  }`}
                >
                  {formatDuration(r.clock_in, r.clock_out)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}