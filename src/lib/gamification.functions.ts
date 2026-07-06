import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { format, subDays, parseISO, differenceInMinutes } from "date-fns";

const MEETING_DOWS = [3, 4, 5]; // Wed, Thu, Fri

function meetingDaysBetween(from: Date, to: Date): string[] {
  const days: string[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    if (MEETING_DOWS.includes(d.getDay())) days.push(format(d, "yyyy-MM-dd"));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export const getStudentGamification = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ studentId: z.string().trim().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = format(subDays(new Date(), 120), "yyyy-MM-dd");
    const { data: rows } = await supabaseAdmin
      .from("attendance")
      .select("date")
      .ilike("student_id", data.studentId)
      .gte("date", from)
      .order("date", { ascending: false });
    const attended = new Set((rows ?? []).map((r) => r.date));

    // Streak: walk back day-by-day through meeting days
    let streak = 0;
    const cur = new Date();
    for (let i = 0; i < 120; i++) {
      const dow = cur.getDay();
      if (MEETING_DOWS.includes(dow)) {
        const key = format(cur, "yyyy-MM-dd");
        if (attended.has(key)) streak += 1;
        else break;
      }
      cur.setDate(cur.getDate() - 1);
    }

    // Perfect weeks: count ISO weeks in last 8 where all past meeting days attended
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let perfectWeeks = 0;
    for (let w = 0; w < 8; w++) {
      const anchor = subDays(today, w * 7);
      const day = anchor.getDay();
      const monday = subDays(anchor, ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekMeetings = meetingDaysBetween(monday, sunday > today ? today : sunday);
      if (weekMeetings.length === 0) continue;
      const allPresent = weekMeetings.every((d) => attended.has(d));
      if (allPresent) perfectWeeks += 1;
    }

    // Total meeting days attended (last 120 days scope)
    const totalAttended = attended.size;
    // XP formula: 20 per attendance + 15 per perfect week + streak * 5 bonus
    const xp = totalAttended * 20 + perfectWeeks * 15 + streak * 5;
    // Level: every 200 XP
    const level = Math.max(1, Math.floor(xp / 200) + 1);
    const xpIntoLevel = xp % 200;
    const xpForNext = 200;

    return {
      streak,
      perfectWeeks,
      totalAttended,
      xp,
      level,
      xpIntoLevel,
      xpForNext,
    };
  });

export const getCohortYearbook = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ cohortId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cohort, error: cErr } = await supabaseAdmin
      .from("cohorts")
      .select("id, name, color, start_date, end_date, duration_weeks, is_ongoing")
      .eq("id", data.cohortId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cohort) throw new Error("Cohort not found");

    const { data: students } = await supabaseAdmin
      .from("students")
      .select("student_id, full_name")
      .eq("cohort_id", cohort.id);
    const roster = students ?? [];

    const start = cohort.start_date ? parseISO(cohort.start_date) : subDays(new Date(), 84);
    const end =
      cohort.end_date && !cohort.is_ongoing ? parseISO(cohort.end_date) : new Date();
    const meetingDates = meetingDaysBetween(start, end);
    const totalMeetings = meetingDates.length || 1;

    // Attendance rows for cohort's students within range
    const ids = roster.map((r) => r.student_id);
    const attRows = ids.length
      ? (
          await supabaseAdmin
            .from("attendance")
            .select("student_id, student_name, date, clock_in, clock_out")
            .in("student_id", ids)
            .gte("date", format(start, "yyyy-MM-dd"))
            .lte("date", format(end, "yyyy-MM-dd"))
        ).data ?? []
      : [];

    // Per-student attended set
    const byStudent = new Map<string, Set<string>>();
    let totalMinutes = 0;
    let sessionCount = 0;
    for (const r of attRows) {
      if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, new Set());
      byStudent.get(r.student_id)!.add(r.date);
      if (r.clock_in && r.clock_out) {
        totalMinutes += Math.max(
          0,
          differenceInMinutes(parseISO(r.clock_out), parseISO(r.clock_in)),
        );
        sessionCount += 1;
      }
    }

    // Compute streaks per student (max consecutive meeting-day attendance)
    function maxStreakFor(attended: Set<string>): number {
      let max = 0;
      let cur = 0;
      for (const d of meetingDates) {
        if (attended.has(d)) {
          cur += 1;
          if (cur > max) max = cur;
        } else cur = 0;
      }
      return max;
    }

    const perStudent = roster.map((s) => {
      const set = byStudent.get(s.student_id) ?? new Set();
      const attended = set.size;
      const pct = Math.round((attended / totalMeetings) * 100);
      return {
        studentId: s.student_id,
        name: s.full_name,
        attended,
        pct,
        streak: maxStreakFor(set),
      };
    });
    perStudent.sort((a, b) => b.pct - a.pct || b.streak - a.streak);

    const overallPct =
      perStudent.length === 0
        ? 0
        : Math.round(
            perStudent.reduce((s, r) => s + r.pct, 0) / perStudent.length,
          );

    // Top reviews
    const { data: reviews } = ids.length
      ? await supabaseAdmin
          .from("session_reviews")
          .select("student_name, class_rating, achievements, class_feedback, date")
          .eq("cohort_id", cohort.id)
          .order("class_rating", { ascending: false })
          .limit(50)
      : { data: [] };
    const avgRating =
      (reviews ?? []).length === 0
        ? 0
        : Math.round(
            ((reviews ?? []).reduce((s, r) => s + (r.class_rating ?? 0), 0) /
              (reviews ?? []).length) *
              10,
          ) / 10;
    const topReviews = (reviews ?? [])
      .filter((r) => (r.achievements ?? r.class_feedback ?? "").trim().length > 12)
      .slice(0, 3)
      .map((r) => ({
        name: r.student_name,
        rating: r.class_rating,
        text: (r.achievements || r.class_feedback || "").slice(0, 180),
      }));

    return {
      cohort: {
        id: cohort.id,
        name: cohort.name,
        color: cohort.color,
        startDate: cohort.start_date,
        endDate: cohort.end_date,
        isOngoing: cohort.is_ongoing,
      },
      overallPct,
      totalMeetings,
      studentCount: roster.length,
      totalHours: Math.round(totalMinutes / 6) / 10,
      sessionCount,
      avgRating,
      leader: perStudent[0] ?? null,
      streakLeader: [...perStudent].sort((a, b) => b.streak - a.streak)[0] ?? null,
      topPerformers: perStudent.slice(0, 5),
      topReviews,
    };
  });