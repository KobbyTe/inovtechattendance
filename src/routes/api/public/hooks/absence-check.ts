import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MEETING_DAYS } from "@/lib/attendance";
import { format } from "date-fns";
import { sendGmail, absenceEmail } from "@/lib/gmail.server";

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

        const [
          { data: students, error: sErr },
          { data: present, error: aErr },
          { data: existing, error: exErr },
          { data: settings },
        ] = await Promise.all([
          supabaseAdmin.from("students").select("student_id, full_name, guardian_name, guardian_email"),
          supabaseAdmin.from("attendance").select("student_id").eq("date", date),
          supabaseAdmin.from("absences").select("student_id").eq("date", date),
          supabaseAdmin
            .from("app_settings")
            .select("email_subject,email_body,email_header_image_url,email_signature")
            .eq("singleton", true)
            .maybeSingle(),
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

        // Email guardians (best-effort, in parallel)
        const emailResults = await Promise.all(
          absent.map(async (s) => {
            if (!s.guardian_email) return { student_id: s.student_id, skipped: "no guardian email" };
            const msg = absenceEmail({
              guardianName: s.guardian_name,
              studentName: s.full_name,
              dayName,
              date,
              subjectTemplate: settings?.email_subject ?? null,
              bodyTemplate: settings?.email_body ?? null,
              headerImageUrl: settings?.email_header_image_url ?? null,
              signature: settings?.email_signature ?? null,
            });
            const r = await sendGmail({ to: s.guardian_email, ...msg });
            return { student_id: s.student_id, ...r };
          }),
        );
        const emailed = emailResults.filter((r) => "ok" in r && r.ok).length;
        const emailErrors = emailResults
          .filter((r) => "ok" in r && r.ok === false)
          .map((r) => ("error" in r ? r.error : ""));

        return Response.json({
          ok: true,
          date,
          dayName,
          inserted: rows.length,
          emailed,
          emailErrors: emailErrors.slice(0, 5),
        });
      },
    },
  },
});