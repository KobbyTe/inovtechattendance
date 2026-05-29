import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceRecord } from "@/types";
import { formatDuration, formatTime, initials, todayDateStr } from "@/lib/attendance";

export function TodayAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayDateStr();
    const load = async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today)
        .order("clock_in", { ascending: false });
      setRecords((data ?? []) as AttendanceRecord[]);
      setLoading(false);
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
      <div className="glass rounded-xl px-4 py-2.5 mb-3">
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
          Today's Attendance · {records.length}
        </h2>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rounded-xl glass h-16 shimmer" />
          ))}
        </ul>
      ) : records.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <svg
            className="mx-auto h-20 w-20 text-blue-200/70"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="8" y="12" width="48" height="44" rx="4" />
            <path d="M8 24h48M20 8v8M44 8v8" />
            <circle cx="32" cy="40" r="8" />
            <path d="M32 36v4l3 2" />
          </svg>
          <p className="mt-4 text-sm font-medium text-white">
            No one has clocked in yet today.
          </p>
          <p className="text-xs text-blue-100/80 mt-1">Be the first!</p>
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {records.map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="glass rounded-xl p-3 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-white/30 text-white font-bold flex items-center justify-center text-sm shrink-0 border border-white/30">
                  {initials(r.student_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate">
                    {r.student_name}
                  </p>
                  <p className="text-xs text-blue-100/80">{r.student_id}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-xs text-blue-100/80 justify-end">
                    <Clock className="h-3 w-3" />
                    {formatTime(r.clock_in)}
                    {r.clock_out ? ` → ${formatTime(r.clock_out)}` : ""}
                  </div>
                  <p
                    className={`text-xs font-bold ${
                      r.clock_out ? "text-white" : "text-green-300"
                    }`}
                  >
                    {formatDuration(r.clock_in, r.clock_out)}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}