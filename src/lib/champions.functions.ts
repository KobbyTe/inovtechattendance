import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { format, parseISO, subDays } from "date-fns";

const MEETING_DOWS = [3, 4, 5];

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

type ChampionResult = {
  studentId: string;
  name: string;
  attended: number;
  earlyBirdDays: number;
  score: number;
  cohort: { id: string; name: string; color: string } | null;
} | null;

async function computeChampions(
  cohortId: string | null,
): Promise<{
  champion: ChampionResult;
  earlyBird: ChampionResult;
  perStudent: Array<{
    studentId: string;
    name: string;
    attended: number;
    earlyBirdDays: number;
    score: number;
  }>;
  windowStart: string;
  windowEnd: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const start = format(subDays(new Date(), 120), "yyyy-MM-dd");
  const end = format(new Date(), "yyyy-MM-dd");

  let cohortMeta: { id: string; name: string; color: string } | null = null;

  let studentQ = supabaseAdmin.from("students").select("student_id, full_name, cohort_id");
  if (cohortId) studentQ = studentQ.eq("cohort_id", cohortId);
  const { data: students } = await studentQ;
  const roster = students ?? [];
  if (cohortId) {
    const { data: c } = await supabaseAdmin
      .from("cohorts")
      .select("id, name, color")
      .eq("id", cohortId)
      .maybeSingle();
    cohortMeta = c ?? null;
  }
  if (roster.length === 0) {
    return { champion: null, earlyBird: null, perStudent: [], windowStart: start, windowEnd: end };
  }

  const ids = roster.map((r) => r.student_id);
  const { data: rows } = await supabaseAdmin
    .from("attendance")
    .select("student_id, student_name, date, clock_in")
    .in("student_id", ids)
    .gte("date", start)
    .lte("date", end)
    .order("clock_in", { ascending: true });

  const attendedByStudent = new Map<string, Set<string>>();
  const earliestByDate = new Map<string, { studentId: string; clockIn: string }>();
  for (const r of rows ?? []) {
    if (!attendedByStudent.has(r.student_id)) attendedByStudent.set(r.student_id, new Set());
    attendedByStudent.get(r.student_id)!.add(r.date);
    const cur = earliestByDate.get(r.date);
    if (!cur || r.clock_in < cur.clockIn) {
      earliestByDate.set(r.date, { studentId: r.student_id, clockIn: r.clock_in });
    }
  }
  const earlyBirdCount = new Map<string, number>();
  for (const [, v] of earliestByDate) {
    earlyBirdCount.set(v.studentId, (earlyBirdCount.get(v.studentId) ?? 0) + 1);
  }

  const perStudent = roster.map((s) => {
    const attended = attendedByStudent.get(s.student_id)?.size ?? 0;
    const earlyBirdDays = earlyBirdCount.get(s.student_id) ?? 0;
    // Combined crown score: attendance dominates, early-bird is a bonus tiebreaker.
    const score = attended * 2 + earlyBirdDays;
    return {
      studentId: s.student_id,
      name: s.full_name,
      attended,
      earlyBirdDays,
      score,
    };
  });

  const byScore = [...perStudent].sort(
    (a, b) => b.score - a.score || b.attended - a.attended || b.earlyBirdDays - a.earlyBirdDays,
  );
  const byEarly = [...perStudent].sort(
    (a, b) => b.earlyBirdDays - a.earlyBirdDays || b.attended - a.attended,
  );

  const champion: ChampionResult =
    byScore[0] && byScore[0].attended > 0
      ? { ...byScore[0], cohort: cohortMeta }
      : null;
  const earlyBird: ChampionResult =
    byEarly[0] && byEarly[0].earlyBirdDays > 0
      ? { ...byEarly[0], cohort: cohortMeta }
      : null;

  return { champion, earlyBird, perStudent, windowStart: start, windowEnd: end };
}

export const getCurrentChampions = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ cohortId: z.string().uuid().nullable().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const r = await computeChampions(data.cohortId ?? null);
    return { champion: r.champion, earlyBird: r.earlyBird };
  });

export const getStudentTitles = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({ studentId: z.string().trim().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("students")
      .select("student_id, cohort_id")
      .ilike("student_id", data.studentId)
      .maybeSingle();
    if (!s) return { titles: [] as Array<"champion" | "earlyBird"> };
    const r = await computeChampions(s.cohort_id ?? null);
    const titles: Array<"champion" | "earlyBird"> = [];
    if (r.champion?.studentId === s.student_id) titles.push("champion");
    if (r.earlyBird?.studentId === s.student_id) titles.push("earlyBird");
    return { titles };
  });

/** Weekly recap for a cohort. */
export const getCohortWeekbook = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        cohortId: z.string().uuid(),
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cohort } = await supabaseAdmin
      .from("cohorts")
      .select("id, name, color")
      .eq("id", data.cohortId)
      .maybeSingle();
    if (!cohort) throw new Error("Cohort not found");

    const anchor = data.weekStart ? parseISO(data.weekStart) : new Date();
    const day = anchor.getDay();
    const monday = new Date(anchor);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(anchor.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekMeetings = meetingDaysBetween(monday, sunday);

    const { data: students } = await supabaseAdmin
      .from("students")
      .select("student_id, full_name")
      .eq("cohort_id", cohort.id);
    const roster = students ?? [];
    const ids = roster.map((r) => r.student_id);

    const startStr = format(monday, "yyyy-MM-dd");
    const endStr = format(sunday, "yyyy-MM-dd");
    const { data: attRows } = ids.length
      ? await supabaseAdmin
          .from("attendance")
          .select("student_id, student_name, date, clock_in, clock_out")
          .in("student_id", ids)
          .gte("date", startStr)
          .lte("date", endStr)
          .order("clock_in", { ascending: true })
      : { data: [] };

    const attByStudent = new Map<string, Set<string>>();
    const earliestByDate = new Map<string, { studentId: string; name: string }>();
    let totalMinutes = 0;
    let sessionCount = 0;
    for (const r of attRows ?? []) {
      if (!attByStudent.has(r.student_id)) attByStudent.set(r.student_id, new Set());
      attByStudent.get(r.student_id)!.add(r.date);
      const cur = earliestByDate.get(r.date);
      if (!cur) earliestByDate.set(r.date, { studentId: r.student_id, name: r.student_name });
      if (r.clock_in && r.clock_out) {
        totalMinutes += Math.max(
          0,
          (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000,
        );
        sessionCount += 1;
      }
    }
    const earlyCount = new Map<string, number>();
    for (const [, v] of earliestByDate)
      earlyCount.set(v.studentId, (earlyCount.get(v.studentId) ?? 0) + 1);

    const perStudent = roster.map((s) => {
      const attended = attByStudent.get(s.student_id)?.size ?? 0;
      const earlyBird = earlyCount.get(s.student_id) ?? 0;
      const total = weekMeetings.length || 1;
      const pct = Math.round((attended / total) * 100);
      return {
        studentId: s.student_id,
        name: s.full_name,
        attended,
        earlyBird,
        pct,
      };
    });
    perStudent.sort((a, b) => b.pct - a.pct || b.earlyBird - a.earlyBird);

    const overallPct =
      perStudent.length === 0
        ? 0
        : Math.round(perStudent.reduce((s, r) => s + r.pct, 0) / perStudent.length);

    const champBase = [...perStudent].sort(
      (a, b) => b.attended * 2 + b.earlyBird - (a.attended * 2 + a.earlyBird),
    );
    const champion = champBase[0]?.attended ? champBase[0] : null;
    const earlyBirdLeader =
      [...perStudent].sort((a, b) => b.earlyBird - a.earlyBird)[0]?.earlyBird
        ? [...perStudent].sort((a, b) => b.earlyBird - a.earlyBird)[0]
        : null;

    // Reviews this week
    const { data: reviews } = ids.length
      ? await supabaseAdmin
          .from("session_reviews")
          .select("student_name, class_rating, achievements, class_feedback, date")
          .eq("cohort_id", cohort.id)
          .gte("date", startStr)
          .lte("date", endStr)
          .order("class_rating", { ascending: false })
          .limit(30)
      : { data: [] };
    const topReviews = (reviews ?? [])
      .filter((r) => (r.achievements ?? r.class_feedback ?? "").trim().length > 12)
      .slice(0, 3)
      .map((r) => ({
        name: r.student_name,
        rating: r.class_rating,
        text: (r.achievements || r.class_feedback || "").slice(0, 180),
      }));

    return {
      cohort,
      weekStart: startStr,
      weekEnd: endStr,
      meetingDays: weekMeetings,
      overallPct,
      totalHours: Math.round(totalMinutes / 6) / 10,
      sessionCount,
      studentCount: roster.length,
      champion,
      earlyBirdLeader,
      topPerformers: perStudent.slice(0, 5),
      topReviews,
    };
  });
