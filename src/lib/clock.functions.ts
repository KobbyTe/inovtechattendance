import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { format } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyQrToken } from "./attendance-qr.server";
import { sendGmail, clockEventEmail } from "./gmail.server";
import { analyzeAndTagReview } from "./sentiment.server";

async function sendClockNotifications(params: {
  studentName: string;
  studentEmail: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  action: "in" | "out";
  now: Date;
}) {
  try {
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select(
        "email_header_image_url,email_signature,clockin_student_subject,clockin_student_body,clockin_guardian_subject,clockin_guardian_body,clockout_student_subject,clockout_student_body,clockout_guardian_subject,clockout_guardian_body",
      )
      .eq("singleton", true)
      .maybeSingle();

    const common = {
      studentName: params.studentName,
      action: params.action,
      dayName: format(params.now, "EEEE"),
      date: format(params.now, "yyyy-MM-dd"),
      time: format(params.now, "h:mm a"),
      headerImageUrl: settings?.email_header_image_url ?? null,
      signature: settings?.email_signature ?? null,
    };

    const tpl = {
      studentSubject:
        params.action === "in"
          ? settings?.clockin_student_subject
          : settings?.clockout_student_subject,
      studentBody:
        params.action === "in"
          ? settings?.clockin_student_body
          : settings?.clockout_student_body,
      guardianSubject:
        params.action === "in"
          ? settings?.clockin_guardian_subject
          : settings?.clockout_guardian_subject,
      guardianBody:
        params.action === "in"
          ? settings?.clockin_guardian_body
          : settings?.clockout_guardian_body,
    };

    const sends: Promise<unknown>[] = [];
    if (params.studentEmail) {
      const msg = clockEventEmail({
        ...common,
        audience: "student",
        recipientName: params.studentName,
        subjectTemplate: tpl.studentSubject ?? null,
        bodyTemplate: tpl.studentBody ?? null,
      });
      sends.push(sendGmail({ to: params.studentEmail, ...msg }));
    }
    if (params.guardianEmail) {
      const msg = clockEventEmail({
        ...common,
        audience: "guardian",
        recipientName: params.guardianName,
        subjectTemplate: tpl.guardianSubject ?? null,
        bodyTemplate: tpl.guardianBody ?? null,
      });
      sends.push(sendGmail({ to: params.guardianEmail, ...msg }));
    }
    await Promise.all(sends);
  } catch (e) {
    console.error("clock notification failed", e);
  }
}

const tokenSchema = z.string().min(1).max(512);
const studentIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const lookupStudentForClockIn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ token: tokenSchema, studentId: studentIdSchema }).parse(i),
  )
  .handler(async ({ data }) => {
    const t = verifyQrToken(data.token);
    if (!t.valid) throw new Error(t.reason || "Invalid QR code");

    const { data: s, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name, student_id, year_level, cohort_id")
      .ilike("student_id", data.studentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) throw new Error("Invalid Student ID");

    let cohort: {
      id: string;
      name: string;
      color: string;
    } | null = null;
    if (s.cohort_id) {
      const { data: c } = await supabaseAdmin
        .from("cohorts")
        .select("id, name, color")
        .eq("id", s.cohort_id)
        .maybeSingle();
      cohort = c ?? null;
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const { data: rec } = await supabaseAdmin
      .from("attendance")
      .select("clock_out")
      .eq("student_id", s.student_id)
      .eq("date", today)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    const status: "none" | "active" | "complete" = !rec
      ? "none"
      : rec.clock_out
        ? "complete"
        : "active";

    return { student: s, cohort, status };
  });

export const clockAction = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: tokenSchema,
        studentId: studentIdSchema,
        action: z.enum(["in", "out"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const t = verifyQrToken(data.token);
    if (!t.valid) throw new Error(t.reason || "Invalid QR code");

    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const dayName = format(now, "EEEE");

    const { data: s, error: sErr } = await supabaseAdmin
      .from("students")
      .select("student_id, full_name, cohort_id")
      .ilike("student_id", data.studentId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!s) throw new Error("Invalid Student ID");

    const { assertCohortClockable } = await import("./cohort-lifecycle.server");
    await assertCohortClockable(supabaseAdmin as never, s.cohort_id);

    if (data.action === "in") {
      const { error } = await supabaseAdmin.from("attendance").insert({
        student_id: s.student_id,
        student_name: s.full_name,
        date: today,
        day_name: dayName,
      });
      if (error) throw new Error(error.message);
      const { data: contacts } = await supabaseAdmin
        .from("students")
        .select("student_email, guardian_name, guardian_email")
        .eq("student_id", s.student_id)
        .maybeSingle();
      await sendClockNotifications({
        studentName: s.full_name,
        studentEmail: contacts?.student_email ?? null,
        guardianName: contacts?.guardian_name ?? null,
        guardianEmail: contacts?.guardian_email ?? null,
        action: "in",
        now,
      });
      return { status: "active" as const };
    }

    const { data: open } = await supabaseAdmin
      .from("attendance")
      .select("id")
      .eq("student_id", s.student_id)
      .eq("date", today)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .maybeSingle();
    if (!open) throw new Error("No active clock-in found for today.");

    const { error } = await supabaseAdmin
      .from("attendance")
      .update({ clock_out: now.toISOString() })
      .eq("id", open.id);
    if (error) throw new Error(error.message);
    const { data: contacts } = await supabaseAdmin
      .from("students")
      .select("student_email, guardian_name, guardian_email")
      .eq("student_id", s.student_id)
      .maybeSingle();
    await sendClockNotifications({
      studentName: s.full_name,
      studentEmail: contacts?.student_email ?? null,
      guardianName: contacts?.guardian_name ?? null,
      guardianEmail: contacts?.guardian_email ?? null,
      action: "out",
      now,
    });
    return { status: "complete" as const, attendanceId: open.id };
  });

export const submitSessionReview = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: tokenSchema,
        studentId: studentIdSchema,
        attendanceId: z.string().uuid().nullable().optional(),
        classRating: z.number().int().min(1).max(5),
        enjoyment: z.boolean().nullable().optional(),
        achievements: z.string().max(300).nullable().optional(),
        classFeedback: z.string().max(300).nullable().optional(),
        teacherNote: z.string().max(400).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    // Accept either the daily attendance token OR a permanent student QR
    // token — the kiosk uses the student token for auto-scan flows.
    if (data.token.startsWith("stu.")) {
      const { verifyStudentToken } = await import("./student-qr.server");
      const st = verifyStudentToken(data.token);
      if (!st.valid) throw new Error(st.reason || "Invalid QR code");
      if (st.studentId?.toUpperCase() !== data.studentId.toUpperCase()) {
        throw new Error("Student mismatch");
      }
    } else {
      const t = verifyQrToken(data.token);
      if (!t.valid) throw new Error(t.reason || "Invalid QR code");
    }

    const { data: s, error: sErr } = await supabaseAdmin
      .from("students")
      .select("student_id, full_name, cohort_id")
      .ilike("student_id", data.studentId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!s) throw new Error("Invalid Student ID");

    const today = format(new Date(), "yyyy-MM-dd");
    const { data: inserted, error } = await supabaseAdmin
      .from("session_reviews")
      .insert({
      attendance_id: data.attendanceId ?? null,
      student_id: s.student_id,
      student_name: s.full_name,
      cohort_id: s.cohort_id,
      date: today,
      class_rating: data.classRating,
      enjoyment: data.enjoyment ?? null,
      achievements: data.achievements?.trim() || null,
      class_feedback: data.classFeedback?.trim() || null,
      teacher_note: data.teacherNote?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const combined = [
      data.achievements,
      data.classFeedback,
      data.teacherNote,
    ]
      .filter(Boolean)
      .join("\n");
    if (inserted?.id && combined.trim()) {
      // Fire and forget; do not block the student's UI on the AI call.
      void analyzeAndTagReview(inserted.id, combined);
    }
    return { ok: true as const };
  });