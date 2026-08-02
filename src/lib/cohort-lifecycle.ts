import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";

export type CohortStatus = "upcoming" | "active" | "ended";

export interface LifecycleCohort {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  grace_period_days: number | null;
  is_ongoing: boolean;
  is_ended: boolean;
  ended_at: string | null;
}

/** Effective last day a cohort counts as active (end_date + grace period). */
export function effectiveEndDate(c: {
  end_date: string | null;
  grace_period_days: number | null;
  is_ongoing: boolean;
}): Date | null {
  if (c.is_ongoing || !c.end_date) return null;
  return addDays(parseISO(c.end_date), c.grace_period_days ?? 7);
}

/** Pure status computation for a cohort at a given moment. */
export function computeCohortStatus(c: LifecycleCohort, now = new Date()): CohortStatus {
  // A manual force-end (is_ended) is sticky and always wins.
  if (c.is_ended || c.status === "ended") return "ended";
  if (c.start_date && parseISO(c.start_date) > now) return "upcoming";
  const eff = effectiveEndDate(c);
  if (eff && now >= eff) return "ended";
  return "active";
}

/** Days remaining until end_date (null for ongoing / undated cohorts). */
export function daysRemaining(
  c: { end_date: string | null; is_ongoing: boolean },
  now = new Date(),
): number | null {
  if (c.is_ongoing || !c.end_date) return null;
  return differenceInCalendarDays(parseISO(c.end_date), now);
}

