import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceRecord, Student } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration, formatTime, initials, MEETING_DAYS } from "@/lib/attendance";
import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";

export function RecordsTab() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [student, setStudent] = useState<string>("all");
  const [day, setDay] = useState<string>("all");

  useEffect(() => {
    supabase
      .from("attendance")
      .select("*")
      .order("date", { ascending: false })
      .order("clock_in", { ascending: false })
      .then(({ data }) => setRecords((data ?? []) as AttendanceRecord[]));
    supabase
      .from("students")
      .select("*")
      .order("full_name")
      .then(({ data }) => setStudents((data ?? []) as Student[]));
  }, []);

  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          (student === "all" || r.student_id === student) &&
          (day === "all" || r.day_name === day)
      ),
    [records, student, day]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of filtered) {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function exportCSV() {
    const header = ["Date", "Day", "Student ID", "Name", "Clock In", "Clock Out", "Duration"];
    const rows = filtered.map((r) => [
      r.date,
      r.day_name,
      r.student_id,
      r.student_name,
      r.clock_in,
      r.clock_out ?? "",
      formatDuration(r.clock_in, r.clock_out),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Select value={student} onValueChange={setStudent}>
          <SelectTrigger className="h-11 sm:w-56">
            <SelectValue placeholder="All students" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.student_id} value={s.student_id}>
                {s.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={day} onValueChange={setDay}>
          <SelectTrigger className="h-11 sm:w-40">
            <SelectValue placeholder="All days" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All days</SelectItem>
            {MEETING_DAYS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV} className="h-11 sm:ml-auto">
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg bg-card border border-border p-6 text-center text-sm text-muted-foreground">
          No records match the filters.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, rows]) => {
            const dayName = rows[0].day_name;
            const isMeeting = MEETING_DAYS.includes(dayName);
            return (
              <div key={date} className="rounded-xl bg-card border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {format(parseISO(date), "EEEE, MMM d, yyyy")}
                  </p>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isMeeting
                        ? "bg-success/15 text-success"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {dayName}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((r) => (
                    <li key={r.id} className="px-4 py-2.5 flex items-center gap-3">
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
                        <p className="font-semibold">
                          {formatDuration(r.clock_in, r.clock_out)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}