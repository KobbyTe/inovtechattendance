import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MEETING_DAYS } from "@/lib/attendance";
import { format } from "date-fns";

export const Route = createFileRoute("/api/public/hooks/absence-check")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const dayName = format(now, "EEEE");
        const date = format(now, "yyyy-MM-dd");

        if (!MEETING_DAYS.includes(dayName)) {
          return Response.json({ ok: true, skipped: true, reason: "not a meeting day", dayName });
        }

        const [{ data: students, error: sErr }, { data: present, error: aErr }, { data: existing, error: exErr }] =
          await Promise.all([
            supabaseAdmin.from("students").select("student_id, full_name"),
            supabaseAdmin.from("attendance").select("student_id").eq("date", date),
            supabaseAdmin.from("absences").select("student_id").eq("date", date),
          ]);
        if (sErr || aErr || exErr) {
          return Response.json(
            { ok: false, error: sErr?.message ?? aErr?.message ?? exErr?.message },
            { status: 500 },
          );
        }

        const presentIds = new Set((present ?? []).map((r) => r.student_id));
        const existingIds = new Set((existing ?? []).map((r) => r.student_id));
        const absent = (students ?? []).filter(
          (s) => !presentIds.has(s.student_id) && !existingIds.has(s.student_id),
        );

        if (absent.length === 0) {
          return Response.json({ ok: true, date, dayName, inserted: 0 });
        }

        const rows = absent.map((s) => ({
          student_id: s.student_id,
          student_name: s.full_name,
          date,
          day_name: dayName,
        }));
        const { error: insErr } = await supabaseAdmin.from("absences").insert(rows);
        if (insErr) return Response.json({ ok: false, error: insErr.message }, { status: 500 });

        return Response.json({ ok: true, date, dayName, inserted: rows.length });
      },
    },
  },
});