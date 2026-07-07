import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { format, subDays } from "date-fns";

export const getRecentClockIns = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabaseAdmin
      .from("attendance")
      .select("id, student_id, student_name, clock_in, clock_out")
      .eq("date", today)
      .order("clock_in", { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);

    // Attach cohort color
    const ids = Array.from(new Set((data ?? []).map((r) => r.student_id)));
    const cohortByStudent = new Map<string, { name: string; color: string }>();
    if (ids.length) {
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("student_id, cohort_id")
        .in("student_id", ids);
      const cohortIds = Array.from(
        new Set((students ?? []).map((s) => s.cohort_id).filter(Boolean) as string[]),
      );
      const cohorts = cohortIds.length
        ? (
            await supabaseAdmin
              .from("cohorts")
              .select("id, name, color")
              .in("id", cohortIds)
          ).data ?? []
        : [];
      const cMap = new Map(cohorts.map((c) => [c.id, { name: c.name, color: c.color }]));
      (students ?? []).forEach((s) => {
        if (s.cohort_id && cMap.has(s.cohort_id))
          cohortByStudent.set(s.student_id, cMap.get(s.cohort_id)!);
      });
    }

    return (data ?? []).map((r) => {
      const parts = r.student_name.trim().split(/\s+/);
      const firstName = parts[0] ?? r.student_name;
      const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
      return {
        id: r.id,
        studentId: r.student_id,
        firstName,
        lastInitial,
        clockIn: r.clock_in,
        clockOut: r.clock_out,
        action: r.clock_out ? ("out" as const) : ("in" as const),
        cohort: cohortByStudent.get(r.student_id) ?? null,
      };
    });
  },
);

export const getStudentStreak = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ studentId: z.string().trim().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look back up to 60 meeting-days
    const from = format(subDays(new Date(), 90), "yyyy-MM-dd");
    const { data: rows } = await supabaseAdmin
      .from("attendance")
      .select("date")
      .ilike("student_id", data.studentId)
      .gte("date", from)
      .order("date", { ascending: false });
    const dates = new Set((rows ?? []).map((r) => r.date));
    // Only Wed/Thu/Fri count as meeting days
    const meetingDays = [3, 4, 5];
    let streak = 0;
    const d = new Date();
    // Walk back day by day, counting consecutive meeting-days with attendance
    for (let i = 0; i < 90; i++) {
      const dow = d.getDay();
      if (meetingDays.includes(dow)) {
        const key = format(d, "yyyy-MM-dd");
        if (dates.has(key)) streak += 1;
        else if (streak > 0 || i > 0) break;
        else break;
      }
      d.setDate(d.getDate() - 1);
    }
    return { streak };
  });