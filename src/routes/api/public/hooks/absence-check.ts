import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MEETING_DAYS } from "@/lib/attendance";
import { format } from "date-fns";
import { sendGmail, absenceEmail } from "@/lib/gmail.server";

export const Route = createFileRoute("/api/public/hooks/absence-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const testTo = url.searchParams.get("testEmail");
        if (testTo) {
          const { data: settings } = await supabaseAdmin
            .from("app_settings")
            .select(
              "email_header_image_url,email_signature,clockin_student_subject,clockin_student_body,clockin_guardian_subject,clockin_guardian_body,clockout_student_subject,clockout_student_body,clockout_guardian_subject,clockout_guardian_body",
            )
            .eq("singleton", true)
            .maybeSingle();
          const { clockEventEmail } = await import("@/lib/gmail.server");
          const now = new Date();
          const action = (url.searchParams.get("action") as "in" | "out") || "in";
          const audience =
            (url.searchParams.get("audience") as "student" | "guardian") || "student";
          const subjTpl =
            action === "in"
              ? audience === "student"
                ? settings?.clockin_student_subject
                : settings?.clockin_guardian_subject
              : audience === "student"
                ? settings?.clockout_student_subject
                : settings?.clockout_guardian_subject;
          const bodyTpl =
            action === "in"
              ? audience === "student"
                ? settings?.clockin_student_body
                : settings?.clockin_guardian_body
              : audience === "student"
                ? settings?.clockout_student_body
                : settings?.clockout_guardian_body;
          const msg = clockEventEmail({
            studentName: "Test Student",
            recipientName: audience === "guardian" ? "Test Guardian" : "Test Student",
            action,
            dayName: format(now, "EEEE"),
            date: format(now, "yyyy-MM-dd"),
            time: format(now, "h:mm a"),
            audience,
            subjectTemplate: subjTpl ?? null,
            bodyTemplate: bodyTpl ?? null,
            headerImageUrl: settings?.email_header_image_url ?? null,
            signature: settings?.email_signature ?? null,
          });
          const result = await sendGmail({ to: testTo, ...msg });
          return Response.json({
            test: true,
            to: testTo,
            action,
            audience,
            subject: msg.subject,
            headerImageUrl: settings?.email_header_image_url ?? null,
            textPreview: msg.text.slice(0, 300),
            htmlPreview: msg.html.slice(0, 600),
            result,
          });
        }
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
          { data: endedCohorts },
        ] = await Promise.all([
          supabaseAdmin
            .from("students")
            .select("student_id, full_name, guardian_name, guardian_email, cohort_id"),
          supabaseAdmin.from("attendance").select("student_id").eq("date", date),
          supabaseAdmin.from("absences").select("student_id").eq("date", date),
          supabaseAdmin
            .from("app_settings")
            .select("email_subject,email_body,email_header_image_url,email_signature")
            .eq("singleton", true)
            .maybeSingle(),
          supabaseAdmin.from("cohorts").select("id").eq("is_ended", true),
        ]);
        if (sErr || aErr || exErr) {
          return Response.json(
            { ok: false, error: sErr?.message ?? aErr?.message ?? exErr?.message },
            { status: 500 },
          );
        }

        const presentIds = new Set((present ?? []).map((r) => r.student_id));
        const existingIds = new Set((existing ?? []).map((r) => r.student_id));
        const endedCohortIds = new Set((endedCohorts ?? []).map((c) => c.id));
        const absent = (students ?? []).filter(
          (s) =>
            !presentIds.has(s.student_id) &&
            !existingIds.has(s.student_id) &&
            !(s.cohort_id && endedCohortIds.has(s.cohort_id)),
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