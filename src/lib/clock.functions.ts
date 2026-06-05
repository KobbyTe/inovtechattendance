import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { format } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyQrToken } from "./attendance-qr.server";

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
      .select("student_id, full_name")
      .ilike("student_id", data.studentId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!s) throw new Error("Invalid Student ID");

    if (data.action === "in") {
      const { error } = await supabaseAdmin.from("attendance").insert({
        student_id: s.student_id,
        student_name: s.full_name,
        date: today,
        day_name: dayName,
      });
      if (error) throw new Error(error.message);
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
    return { status: "complete" as const };
  });