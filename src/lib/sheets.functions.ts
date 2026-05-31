import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");
  if (!sheetsKey) throw new Error("Missing GOOGLE_SHEETS_API_KEY (link the Google Sheets connector)");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": sheetsKey,
    "Content-Type": "application/json",
  };
}

async function ensureSheet(spreadsheetId: string, title: string) {
  const meta = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}`, {
    headers: gatewayHeaders(),
  });
  if (!meta.ok) {
    throw new Error(`Sheets API error ${meta.status}: ${await meta.text()}`);
  }
  const json = (await meta.json()) as { sheets?: Array<{ properties: { title: string } }> };
  const exists = json.sheets?.some((s) => s.properties.title === title);
  if (exists) return;
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title } } }],
    }),
  });
  if (!res.ok) throw new Error(`Add sheet failed ${res.status}: ${await res.text()}`);
}

async function writeRange(spreadsheetId: string, range: string, values: (string | number | null)[][]) {
  // Clear then write
  const clearRes = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${range}:clear`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: "{}",
  });
  if (!clearRes.ok) throw new Error(`Clear failed ${clearRes.status}: ${await clearRes.text()}`);
  const res = await fetch(
    `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: gatewayHeaders(),
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
  if (!res.ok) throw new Error(`Write failed ${res.status}: ${await res.text()}`);
}

export const syncToGoogleSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ spreadsheetId: z.string().min(10).max(120) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const spreadsheetId = data.spreadsheetId.trim();

    const [{ data: students, error: sErr }, { data: attendance, error: aErr }, { data: cohorts, error: cErr }] =
      await Promise.all([
        supabase.from("students").select("*").order("student_id"),
        supabase.from("attendance").select("*").order("date", { ascending: false }).order("clock_in", { ascending: false }),
        supabase.from("cohorts").select("*").order("name"),
      ]);
    if (sErr) throw new Error(sErr.message);
    if (aErr) throw new Error(aErr.message);
    if (cErr) throw new Error(cErr.message);

    const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c.name] as const));

    await ensureSheet(spreadsheetId, "Students");
    await ensureSheet(spreadsheetId, "Attendance");
    await ensureSheet(spreadsheetId, "Cohorts");

    const studentRows: (string | number | null)[][] = [
      ["Student ID", "Full Name", "Year Level", "Cohort", "Student Email", "Guardian Name", "Guardian Email", "Created At"],
      ...(students ?? []).map((s) => [
        s.student_id,
        s.full_name,
        s.year_level,
        s.cohort_id ? cohortById.get(s.cohort_id) ?? "" : "",
        s.student_email ?? "",
        s.guardian_name ?? "",
        s.guardian_email ?? "",
        s.created_at,
      ]),
    ];

    const attendanceRows: (string | number | null)[][] = [
      ["Date", "Day", "Student ID", "Student Name", "Cohort", "Clock In", "Clock Out"],
      ...(attendance ?? []).map((r) => {
        const student = (students ?? []).find((s) => s.student_id === r.student_id);
        const cohortName = student?.cohort_id ? cohortById.get(student.cohort_id) ?? "" : "";
        return [r.date, r.day_name, r.student_id, r.student_name, cohortName, r.clock_in, r.clock_out ?? ""];
      }),
    ];

    const cohortRows: (string | number | null)[][] = [
      ["Code", "Name", "Duration (weeks)", "Start", "End", "Ongoing", "Color"],
      ...(cohorts ?? []).map((c) => [
        c.code,
        c.name,
        c.duration_weeks ?? "",
        c.start_date ?? "",
        c.end_date ?? "",
        c.is_ongoing ? "Yes" : "No",
        c.color,
      ]),
    ];

    await writeRange(spreadsheetId, "Students!A1:H", studentRows);
    await writeRange(spreadsheetId, "Attendance!A1:G", attendanceRows);
    await writeRange(spreadsheetId, "Cohorts!A1:G", cohortRows);

    const nowIso = new Date().toISOString();
    await supabase
      .from("app_settings")
      .update({ google_sheet_id: spreadsheetId, last_sheets_sync_at: nowIso, updated_at: nowIso })
      .eq("singleton", true);

    return {
      ok: true,
      synced: {
        students: students?.length ?? 0,
        attendance: attendance?.length ?? 0,
        cohorts: cohorts?.length ?? 0,
      },
      lastSyncAt: nowIso,
    };
  });