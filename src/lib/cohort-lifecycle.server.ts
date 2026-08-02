import { format } from "date-fns";
import { computeCohortStatus, type CohortStatus, type LifecycleCohort } from "./cohort-lifecycle";

/** Build a compact, permanent end-of-cohort yearbook snapshot. */
export async function buildYearbookSnapshot(
  db: { from: (t: string) => any },
  cohortId: string,
) {
  const { data: cohort } = await db
    .from("cohorts")
    .select("id, name, code, color, start_date, end_date, duration_weeks, is_ongoing")
    .eq("id", cohortId)
    .maybeSingle();

  const { data: students } = await db
    .from("students")
    .select("student_id, full_name")
    .eq("cohort_id", cohortId);
  const roster: { student_id: string; full_name: string }[] = students ?? [];
  const ids = roster.map((r) => r.student_id);

  const attRows: { student_id: string; date: string; clock_in: string | null }[] = ids.length
    ? ((
        await db
          .from("attendance")
          .select("student_id, date, clock_in")
          .in("student_id", ids)
      ).data ?? [])
    : [];

  const perStudent = new Map<string, Set<string>>();
  const earliestByDate = new Map<string, { student_id: string; at: string }>();
  for (const r of attRows) {
    if (!perStudent.has(r.student_id)) perStudent.set(r.student_id, new Set());
    perStudent.get(r.student_id)!.add(r.date);
    if (r.clock_in) {
      const cur = earliestByDate.get(r.date);
      if (!cur || r.clock_in < cur.at) earliestByDate.set(r.date, { student_id: r.student_id, at: r.clock_in });
    }
  }
  const meetingDays = new Set(attRows.map((r) => r.date)).size || 1;

  const earlyBirdCounts = new Map<string, number>();
  for (const v of earliestByDate.values()) {
    earlyBirdCounts.set(v.student_id, (earlyBirdCounts.get(v.student_id) ?? 0) + 1);
  }

  const leaderboard = roster
    .map((s) => {
      const attended = perStudent.get(s.student_id)?.size ?? 0;
      return {
        studentId: s.student_id,
        name: s.full_name,
        attended,
        pct: Math.round((attended / meetingDays) * 100),
        earlyBirdDays: earlyBirdCounts.get(s.student_id) ?? 0,
      };
    })
    .sort((a, b) => b.attended - a.attended || b.earlyBirdDays - a.earlyBirdDays);

  const { data: reviews } = await db
    .from("session_reviews")
    .select("student_name, class_rating, achievements, class_feedback")
    .eq("cohort_id", cohortId)
    .order("class_rating", { ascending: false })
    .limit(50);

  const revs: { student_name: string; class_rating: number | null; achievements: string | null; class_feedback: string | null }[] =
    reviews ?? [];
  const avgRating =
    revs.length === 0
      ? 0
      : Math.round((revs.reduce((s, r) => s + (r.class_rating ?? 0), 0) / revs.length) * 10) / 10;

  return {
    generatedAt: new Date().toISOString(),
    cohort: cohort ?? { id: cohortId },
    meetingDays,
    rosterSize: roster.length,
    avgAttendancePct:
      leaderboard.length === 0
        ? 0
        : Math.round(leaderboard.reduce((s, r) => s + r.pct, 0) / leaderboard.length),
    champion: leaderboard[0] ?? null,
    earlyBird:
      [...leaderboard].sort((a, b) => b.earlyBirdDays - a.earlyBirdDays)[0] ?? null,
    leaderboard: leaderboard.slice(0, 25),
    avgRating,
    topReviews: revs
      .filter((r) => (r.achievements ?? r.class_feedback ?? "").trim().length > 12)
      .slice(0, 3)
      .map((r) => ({
        name: r.student_name,
        rating: r.class_rating,
        text: (r.achievements || r.class_feedback || "").slice(0, 180),
      })),
  };
}

/**
 * Idempotent: generates the yearbook snapshot for a cohort exactly once.
 * Returns true when a new snapshot was written.
 */
export async function ensureYearbookGenerated(
  db: { from: (t: string) => any },
  cohortId: string,
): Promise<boolean> {
  const { data: existing } = await db
    .from("cohort_yearbooks")
    .select("id")
    .eq("cohort_id", cohortId)
    .maybeSingle();
  if (existing) return false;
  const snapshot = await buildYearbookSnapshot(db, cohortId);
  const { error } = await db
    .from("cohort_yearbooks")
    .insert({ cohort_id: cohortId, snapshot });
  // A unique-violation means a concurrent run already generated it.
  if (error && error.code !== "23505") throw new Error(error.message);
  return !error;
}

/** Daily lifecycle pass: recompute statuses and fire yearbook generation. */
export async function runCohortLifecycle(db: { from: (t: string) => any }, now = new Date()) {
  const { data, error } = await db
    .from("cohorts")
    .select(
      "id, name, status, start_date, end_date, grace_period_days, is_ongoing, is_ended, ended_at",
    );
  if (error) throw new Error(error.message);
  const cohorts: LifecycleCohort[] = data ?? [];

  const transitions: { id: string; name: string; from: string; to: CohortStatus }[] = [];
  let yearbooksGenerated = 0;

  for (const c of cohorts) {
    const next = computeCohortStatus(c, now);
    if (next === c.status) {
      // Safety net: an already-ended cohort with no yearbook still gets one.
      if (next === "ended") {
        if (await ensureYearbookGenerated(db, c.id)) yearbooksGenerated += 1;
      }
      continue;
    }
    const patch: Record<string, unknown> = { status: next };
    if (next === "ended") {
      patch["is_ended"] = true;
      patch["ended_at"] = now.toISOString();
    }
    const { error: uErr } = await db.from("cohorts").update(patch).eq("id", c.id);
    if (uErr) throw new Error(uErr.message);
    transitions.push({ id: c.id, name: c.name, from: c.status, to: next });
    if (next === "ended") {
      if (await ensureYearbookGenerated(db, c.id)) yearbooksGenerated += 1;
    }
  }

  return {
    checked: cohorts.length,
    transitions,
    yearbooksGenerated,
    ranAt: format(now, "yyyy-MM-dd HH:mm:ss"),
  };
}

export const COHORT_ENDED_MESSAGE = "This cohort has ended — thanks for a great run!";
export const COHORT_UPCOMING_MESSAGE =
  "This cohort hasn't started yet — see you on the first day!";

/**
 * Throws a friendly error when a student's cohort is not currently active.
 * Cohorts with no assigned cohort_id are allowed (walk-in / testing).
 */
export async function assertCohortClockable(
  db: { from: (t: string) => any },
  cohortId: string | null,
) {
  if (!cohortId) return;
  const { data: c } = await db
    .from("cohorts")
    .select("status, is_ended")
    .eq("id", cohortId)
    .maybeSingle();
  if (!c) return;
  if (c.is_ended || c.status === "ended") throw new Error(COHORT_ENDED_MESSAGE);
  if (c.status === "upcoming") throw new Error(COHORT_UPCOMING_MESSAGE);
}
