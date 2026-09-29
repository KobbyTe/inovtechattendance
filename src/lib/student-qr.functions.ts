import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { format } from "date-fns";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const studentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Admin-only: mint a permanent signed QR token for a student. */
export const getStudentQrToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ studentId: studentIdSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { signStudentToken } = await import("./student-qr.server");
    return { token: signStudentToken(data.studentId), studentId: data.studentId.toUpperCase() };
  });

/**
 * Public: student can mint their own permanent QR from the clock-in page,
 * but only after presenting today's valid daily-QR token so random visitors
 * can't harvest tokens for arbitrary IDs.
 */
export const getMyStudentQrToken = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().min(1).max(512),
        studentId: studentIdSchema,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { verifyQrToken } = await import("./attendance-qr.server");
    const t = verifyQrToken(data.token);
    if (!t.valid) throw new Error(t.reason || "Invalid QR code");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("students")
      .select("student_id")
      .ilike("student_id", data.studentId)
      .maybeSingle();
    if (!s) throw new Error("Invalid Student ID");
    const { signStudentToken } = await import("./student-qr.server");
    return { token: signStudentToken(s.student_id), studentId: s.student_id };
  });

/**
 * Public: one-scan kiosk clock in/out using a permanent per-student QR.
 * Auto-detects action from today's most recent record.
 */
export const kioskClockWithStudentToken = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().min(1).max(512),
        action: z.enum(["in", "out"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { verifyStudentToken } = await import("./student-qr.server");
    const v = verifyStudentToken(data.token);
    if (!v.valid || !v.studentId) throw new Error(v.reason || "Invalid QR");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error: sErr } = await supabaseAdmin
      .from("students")
      .select(
        "student_id, full_name, cohort_id, student_email, guardian_name, guardian_email, photo_url",
      )
      .ilike("student_id", v.studentId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!s) throw new Error("Student not found");

    const { assertCohortClockable } = await import("./cohort-lifecycle.server");
    await assertCohortClockable(supabaseAdmin as never, s.cohort_id);

    let cohort: { id: string; name: string; color: string } | null = null;
    if (s.cohort_id) {
      const { data: c } = await supabaseAdmin
        .from("cohorts")
        .select("id, name, color")
        .eq("id", s.cohort_id)
        .maybeSingle();
      cohort = c ?? null;
    }

    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const dayName = format(now, "EEEE");

    const { data: rec } = await supabaseAdmin
      .from("attendance")
      .select("id, clock_out")
      .eq("student_id", s.student_id)
      .eq("date", today)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    const auto: "in" | "out" = !rec ? "in" : rec.clock_out ? "in" : "out";
    const action = data.action ?? auto;

    let attendanceId: string | null = null;

    if (action === "in") {
      if (!rec || rec.clock_out) {
        const { data: ins, error } = await supabaseAdmin.from("attendance").insert({
          student_id: s.student_id,
          student_name: s.full_name,
          date: today,
          day_name: dayName,
        }).select("id").single();
        if (error) throw new Error(error.message);
        attendanceId = ins?.id ?? null;
      } else {
        attendanceId = rec.id;
      }
    } else {
      if (!rec || rec.clock_out) throw new Error("No active clock-in found for today.");
      const { error } = await supabaseAdmin
        .from("attendance")
        .update({ clock_out: now.toISOString() })
        .eq("id", rec.id);
      if (error) throw new Error(error.message);
      attendanceId = rec.id;
    }

    // Best-effort notifications
    try {
      const { sendGmail, clockEventEmail } = await import("./gmail.server");
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select(
          "email_header_image_url,email_signature,clockin_student_subject,clockin_student_body,clockin_guardian_subject,clockin_guardian_body,clockout_student_subject,clockout_student_body,clockout_guardian_subject,clockout_guardian_body",
        )
        .eq("singleton", true)
        .maybeSingle();
      const common = {
        studentName: s.full_name,
        action,
        dayName,
        date: today,
        time: format(now, "h:mm a"),
        headerImageUrl: settings?.email_header_image_url ?? null,
        signature: settings?.email_signature ?? null,
      };
      const tpl = {
        studentSubject:
          action === "in"
            ? settings?.clockin_student_subject
            : settings?.clockout_student_subject,
        studentBody:
          action === "in"
            ? settings?.clockin_student_body
            : settings?.clockout_student_body,
        guardianSubject:
          action === "in"
            ? settings?.clockin_guardian_subject
            : settings?.clockout_guardian_subject,
        guardianBody:
          action === "in"
            ? settings?.clockin_guardian_body
            : settings?.clockout_guardian_body,
      };
      const sends: Promise<unknown>[] = [];
      if (s.student_email) {
        const msg = clockEventEmail({
          ...common,
          audience: "student",
          recipientName: s.full_name,
          subjectTemplate: tpl.studentSubject ?? null,
          bodyTemplate: tpl.studentBody ?? null,
        });
        sends.push(sendGmail({ to: s.student_email, ...msg }));
      }
      if (s.guardian_email) {
        const msg = clockEventEmail({
          ...common,
          audience: "guardian",
          recipientName: s.guardian_name,
          subjectTemplate: tpl.guardianSubject ?? null,
          bodyTemplate: tpl.guardianBody ?? null,
        });
        sends.push(sendGmail({ to: s.guardian_email, ...msg }));
      }
      await Promise.all(sends);
    } catch (e) {
      console.error("kiosk-student-qr notification failed", e);
    }

    return {
      action,
      attendanceId,
      student: {
        student_id: s.student_id,
        full_name: s.full_name,
        photo_url: s.photo_url ?? null,
      },
      cohort,
    };
  });
