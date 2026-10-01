import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addStudentSchema } from "@/lib/student-validation";

const STUDENT_ID_CHARACTERS = "ABCD0123456789";

function randomStudentId(length = 8) {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => STUDENT_ID_CHARACTERS[value % STUDENT_ID_CHARACTERS.length]).join("");
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
      .select("id")
      .eq("id", data.cohort_id)
      .maybeSingle();
    if (cohortError || !cohort) throw new Error("The selected cohort is unavailable");

    let studentId = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomStudentId();
      const { data: match, error: lookupError } = await context.supabase
        .from("students")
        .select("id")
        .eq("student_id", candidate)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);
      if (!match) {
        studentId = candidate;
        break;
      }
    }
    if (!studentId) throw new Error("Could not generate a unique student ID. Please try again.");

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