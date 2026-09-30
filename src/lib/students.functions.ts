import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addStudentSchema } from "@/lib/student-validation";

function nameCode(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 4).padEnd(4, "X").toUpperCase();
  return `${parts[0].slice(0, 2).padEnd(2, "X")}${parts.at(-1)?.slice(0, 2).padEnd(2, "X")}`.toUpperCase();
}

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addStudentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("You do not have permission to add students");

    const { data: cohort, error: cohortError } = await context.supabase
      .from("cohorts")
      .select("id, code")
      .eq("id", data.cohort_id)
      .maybeSingle();
    if (cohortError || !cohort) throw new Error("The selected cohort is unavailable");

    const prefix = `${cohort.code}-${nameCode(data.full_name)}-`;
    const { data: existing, error: lookupError } = await context.supabase
      .from("students")
      .select("student_id")
      .like("student_id", `${prefix}%`);
    if (lookupError) throw new Error(lookupError.message);

    const next = Math.max(
      0,
      ...(existing ?? []).map((row) => Number.parseInt(row.student_id.slice(prefix.length), 10) || 0),
    ) + 1;
    const studentId = `${prefix}${String(next).padStart(3, "0")}`;

    const { data: student, error } = await context.supabase
      .from("students")
      .insert({
        student_id: studentId,
        full_name: data.full_name,
        cohort_id: data.cohort_id,
        year_level: data.year_level,
        guardian_name: data.guardian_name,
        guardian_email: data.guardian_email,
        guardian_phone: data.guardian_phone,
        student_email: data.student_email || null,
        rfid_uid: data.rfid_uid.toUpperCase() || null,
        photo_url: data.photo_url,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("That student ID or RFID card is already assigned");
      throw new Error(error.message);
    }
    return student;
  });