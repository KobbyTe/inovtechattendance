import { supabase } from "@/integrations/supabase/client";

/** Generate a cohort code (3 uppercase letters) from a cohort name. */
export function generateCohortCode(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length >= 3) return letters.slice(0, 3);
  return (letters + "XXX").slice(0, 3);
}

/** Build the NAME_CODE portion: first 2 letters of first name + first 2 of last name. */
export function buildNameCode(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "XXXX";
  if (parts.length === 1) return parts[0].slice(0, 4).padEnd(4, "X").toUpperCase();
  const first = parts[0].slice(0, 2).padEnd(2, "X");
  const last = parts[parts.length - 1].slice(0, 2).padEnd(2, "X");
  return (first + last).toUpperCase();
}

/** Compute the next sequence number for a cohort (1-based, zero-padded to 3). */
export async function nextSequence(cohortId: string): Promise<string> {
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", cohortId);
  return String((count ?? 0) + 1).padStart(3, "0");
}

/** Compose a preview student ID (no DB lookup for sequence — uses placeholder). */
export function previewStudentId(cohortCode: string, fullName: string, seq?: string): string {
  return `${cohortCode}-${buildNameCode(fullName)}-${seq ?? "###"}`;
}

/** Build the final student ID with a fresh sequence. */
export async function generateStudentId(cohortCode: string, cohortId: string, fullName: string): Promise<string> {
  const seq = await nextSequence(cohortId);
  return `${cohortCode}-${buildNameCode(fullName)}-${seq}`;
}

/** Compute end date from start date + duration in weeks. */
export function computeEndDate(startDate: string, weeks: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Palette used when auto-assigning cohort colors. */
export const COHORT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

export function pickCohortColor(index: number): string {
  return COHORT_COLORS[index % COHORT_COLORS.length];
}