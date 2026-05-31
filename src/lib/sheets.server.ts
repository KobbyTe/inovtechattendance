import type { SupabaseClient } from "@supabase/supabase-js";

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
  if (json.sheets?.some((s) => s.properties.title === title)) return;
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  if (!res.ok) throw new Error(`Add sheet failed ${res.status}: ${await res.text()}`);
}

async function writeRange(spreadsheetId: string, range: string, values: (string | number | null)[][]) {
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

export async function performSheetsSync(
  supabase: SupabaseClient,
  spreadsheetId: string,
) {
  const [{ data: students, error: sErr }, { data: attendance, error: aErr }, { data: cohorts, error: cErr }, { data: absences, error: abErr }] =
    await Promise.all([
      supabase.from("students").select("*").order("student_id"),
      supabase.from("attendance").select("*").order("date", { ascending: false }).order("clock_in", { ascending: false }),
      supabase.from("cohorts").select("*").order("name"),
      supabase.from("absences").select("*").order("date", { ascending: false }),
    ]);
  if (sErr) throw new Error(sErr.message);
  if (aErr) throw new Error(aErr.message);
  if (cErr) throw new Error(cErr.message);
  if (abErr) throw new Error(abErr.message);

  const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c.name] as const));

  await ensureSheet(spreadsheetId, "Students");
  await ensureSheet(spreadsheetId, "Attendance");
  await ensureSheet(spreadsheetId, "Cohorts");
  await ensureSheet(spreadsheetId, "Absences");

  const studentRows: (string | number | null)[][] = [
    ["Student ID", "Full Name", "Year Level", "Cohort", "Student Email", "Guardian Name", "Guardian Email", "Created At"],
    ...(students ?? []).map((s: any) => [
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
    ...(attendance ?? []).map((r: any) => {
      const student = (students ?? []).find((s: any) => s.student_id === r.student_id);
      const cohortName = student?.cohort_id ? cohortById.get(student.cohort_id) ?? "" : "";
      return [r.date, r.day_name, r.student_id, r.student_name, cohortName, r.clock_in, r.clock_out ?? ""];
    }),
  ];

  const cohortRows: (string | number | null)[][] = [
    ["Code", "Name", "Duration (weeks)", "Start", "End", "Ongoing", "Color"],
    ...(cohorts ?? []).map((c: any) => [
      c.code,
      c.name,
      c.duration_weeks ?? "",
      c.start_date ?? "",
      c.end_date ?? "",
      c.is_ongoing ? "Yes" : "No",
      c.color,
    ]),
  ];

  const absenceRows: (string | number | null)[][] = [
    ["Date", "Day", "Student ID", "Student Name", "Cohort", "Recorded At"],
    ...(absences ?? []).map((a: any) => {
      const student = (students ?? []).find((s: any) => s.student_id === a.student_id);
      const cohortName = student?.cohort_id ? cohortById.get(student.cohort_id) ?? "" : "";
      return [a.date, a.day_name, a.student_id, a.student_name, cohortName, a.created_at];
    }),
  ];

  await writeRange(spreadsheetId, "Students!A1:H", studentRows);
  await writeRange(spreadsheetId, "Attendance!A1:G", attendanceRows);
  await writeRange(spreadsheetId, "Cohorts!A1:G", cohortRows);
  await writeRange(spreadsheetId, "Absences!A1:F", absenceRows);

  const nowIso = new Date().toISOString();
  await supabase
    .from("app_settings")
    .update({ google_sheet_id: spreadsheetId, last_sheets_sync_at: nowIso, updated_at: nowIso })
    .eq("singleton", true);

  return {
    synced: {
      students: students?.length ?? 0,
      attendance: attendance?.length ?? 0,
      cohorts: cohorts?.length ?? 0,
      absences: absences?.length ?? 0,
    },
    lastSyncAt: nowIso,
  };
}