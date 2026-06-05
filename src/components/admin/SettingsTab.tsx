import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { syncToGoogleSheets } from "@/lib/sheets.functions";
import { ExternalLink, ImagePlus, Mail, RefreshCw, Sheet, Trash2 } from "lucide-react";
import { format } from "date-fns";

function extractSheetId(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : trimmed;
}

export function SettingsTab() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const [sheetInput, setSheetInput] = useState("");
  const [savedSheetId, setSavedSheetId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncFn = useServerFn(syncToGoogleSheets);

  const DEFAULT_SUBJECT = "Absence notice: {{studentName}} — {{dayName}}, {{date}}";
  const DEFAULT_BODY =
    "{{greeting}}\n\nThis is to notify you that {{studentName}} was not marked present at the bootcamp meeting on {{dayName}}, {{date}}.\n\nIf this is unexpected, please contact the program team.";
  const DEFAULT_SIGNATURE = "— Inovtech Student Attendance";

  const CLOCK_DEFAULTS = {
    clockin_student: {
      subject: "You checked in at {{time}} — {{dayName}}, {{date}}",
      body: "{{greeting}}\n\nThis confirms that you checked in for the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.\n\nHave a great session!",
    },
    clockin_guardian: {
      subject: "{{studentName}} checked in at {{time}} — {{dayName}}, {{date}}",
      body: "{{greeting}}\n\nThis is to let you know that {{studentName}} checked in for the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.",
    },
    clockout_student: {
      subject: "You checked out at {{time}} — {{dayName}}, {{date}}",
      body: "{{greeting}}\n\nThis confirms that you checked out from the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.\n\nSee you next time!",
    },
    clockout_guardian: {
      subject: "{{studentName}} checked out at {{time}} — {{dayName}}, {{date}}",
      body: "{{greeting}}\n\nThis is to let you know that {{studentName}} checked out from the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.",
    },
  } as const;

  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
  const [emailHeaderImageUrl, setEmailHeaderImageUrl] = useState<string>("");
  const [emailSignature, setEmailSignature] = useState(DEFAULT_SIGNATURE);
  const [clockTpl, setClockTpl] = useState<{
    clockin_student_subject: string;
    clockin_student_body: string;
    clockin_guardian_subject: string;
    clockin_guardian_body: string;
    clockout_student_subject: string;
    clockout_student_body: string;
    clockout_guardian_subject: string;
    clockout_guardian_body: string;
  }>({
    clockin_student_subject: CLOCK_DEFAULTS.clockin_student.subject,
    clockin_student_body: CLOCK_DEFAULTS.clockin_student.body,
    clockin_guardian_subject: CLOCK_DEFAULTS.clockin_guardian.subject,
    clockin_guardian_body: CLOCK_DEFAULTS.clockin_guardian.body,
    clockout_student_subject: CLOCK_DEFAULTS.clockout_student.subject,
    clockout_student_body: CLOCK_DEFAULTS.clockout_student.body,
    clockout_guardian_subject: CLOCK_DEFAULTS.clockout_guardian.subject,
    clockout_guardian_body: CLOCK_DEFAULTS.clockout_guardian.body,
  });
  const [savingTpl, setSavingTpl] = useState(false);
  const [savingClock, setSavingClock] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select(
        "google_sheet_id,last_sheets_sync_at,email_subject,email_body,email_header_image_url,email_signature,clockin_student_subject,clockin_student_body,clockin_guardian_subject,clockin_guardian_body,clockout_student_subject,clockout_student_body,clockout_guardian_subject,clockout_guardian_body",
      )
      .eq("singleton", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.google_sheet_id) {
          setSavedSheetId(data.google_sheet_id);
          setSheetInput(data.google_sheet_id);
        }
        if (data?.last_sheets_sync_at) setLastSync(data.last_sheets_sync_at);
        if (data?.email_subject) setEmailSubject(data.email_subject);
        if (data?.email_body) setEmailBody(data.email_body);
        if (data?.email_header_image_url) setEmailHeaderImageUrl(data.email_header_image_url);
        if (data?.email_signature) setEmailSignature(data.email_signature);
        if (data) {
          setClockTpl((prev) => ({
            clockin_student_subject: data.clockin_student_subject ?? prev.clockin_student_subject,
            clockin_student_body: data.clockin_student_body ?? prev.clockin_student_body,
            clockin_guardian_subject: data.clockin_guardian_subject ?? prev.clockin_guardian_subject,
            clockin_guardian_body: data.clockin_guardian_body ?? prev.clockin_guardian_body,
            clockout_student_subject: data.clockout_student_subject ?? prev.clockout_student_subject,
            clockout_student_body: data.clockout_student_body ?? prev.clockout_student_body,
            clockout_guardian_subject: data.clockout_guardian_subject ?? prev.clockout_guardian_subject,
            clockout_guardian_body: data.clockout_guardian_body ?? prev.clockout_guardian_body,
          }));
        }
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPw("");
  }

  async function handleSync() {
    const id = extractSheetId(sheetInput);
    if (!id || id.length < 10) return toast.error("Enter a valid Google Sheet URL or ID");
    setSyncing(true);
    try {
      const res = await syncFn({ data: { spreadsheetId: id } });
      setSavedSheetId(id);
      setLastSync(res.lastSyncAt);
      toast.success(
        `Synced ${res.synced.students} students · ${res.synced.attendance} records · ${res.synced.cohorts} cohorts`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function saveTemplate() {
    setSavingTpl(true);
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();
    const payload = {
      singleton: true,
      email_subject: emailSubject,
      email_body: emailBody,
      email_header_image_url: emailHeaderImageUrl || null,
      email_signature: emailSignature,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("app_settings").update(payload).eq("id", existing.id)
      : await supabase.from("app_settings").insert(payload);
    setSavingTpl(false);
    if (error) return toast.error(error.message);
    toast.success("Email template saved");
  }

  function resetTemplate() {
    setEmailSubject(DEFAULT_SUBJECT);
    setEmailBody(DEFAULT_BODY);
    setEmailSignature(DEFAULT_SIGNATURE);
  }

  async function saveClockTemplates() {
    setSavingClock(true);
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();
    const payload = {
      singleton: true,
      ...clockTpl,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("app_settings").update(payload).eq("id", existing.id)
      : await supabase.from("app_settings").insert(payload);
    setSavingClock(false);
    if (error) return toast.error(error.message);
    toast.success("Check-in / check-out templates saved");
  }

  function resetClockTemplates() {
    setClockTpl({
      clockin_student_subject: CLOCK_DEFAULTS.clockin_student.subject,
      clockin_student_body: CLOCK_DEFAULTS.clockin_student.body,
      clockin_guardian_subject: CLOCK_DEFAULTS.clockin_guardian.subject,
      clockin_guardian_body: CLOCK_DEFAULTS.clockin_guardian.body,
      clockout_student_subject: CLOCK_DEFAULTS.clockout_student.subject,
      clockout_student_body: CLOCK_DEFAULTS.clockout_student.body,
      clockout_guardian_subject: CLOCK_DEFAULTS.clockout_guardian.subject,
      clockout_guardian_body: CLOCK_DEFAULTS.clockout_guardian.body,
    });
  }

  async function handleHeaderFile(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const dims = await new Promise<{ w: number; h: number } | null>((res) => {
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res(null);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    if (!dims) return toast.error("Could not read image");
    if (dims.w < 600 || dims.w > 700 || dims.h < 70 || dims.h > 200) {
      return toast.error(
        `Image must be 600–700 px wide and 70–200 px tall. Yours is ${dims.w}×${dims.h}.`,
      );
    }
    setUploadingHeader(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `headers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("email-assets")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("email-assets").getPublicUrl(path);
      setEmailHeaderImageUrl(data.publicUrl);
      toast.success("Header image uploaded — remember to save the template");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingHeader(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-6 max-w-2xl">
      <section className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Guardian absence email</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the email sent to guardians when a student is marked absent. Use the placeholders below to insert dynamic values.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {["{{guardianName}}", "{{studentName}}", "{{dayName}}", "{{date}}", "{{greeting}}"].map((t) => (
            <code key={t} className="rounded bg-muted px-1.5 py-0.5 font-mono">
              {t}
            </code>
          ))}
        </div>
        <div className="space-y-3 mt-4">
          <div className="space-y-2">
            <Label>Header image (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Upload a banner image. Required size: 600–700 px wide, 70–200 px tall.
            </p>
            {emailHeaderImageUrl ? (
              <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                <img
                  src={emailHeaderImageUrl}
                  alt="Email header preview"
                  className="max-w-full h-auto rounded"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingHeader}
                  >
                    <ImagePlus className="mr-1.5 h-4 w-4" />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmailHeaderImageUrl("")}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingHeader}
                className="h-11"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {uploadingHeader ? "Uploading…" : "Upload header image"}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleHeaderFile(f);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={7}
              className="font-sans"
            />
          </div>
          <div className="space-y-2">
            <Label>Signature</Label>
            <Textarea
              value={emailSignature}
              onChange={(e) => setEmailSignature(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={saveTemplate} disabled={savingTpl} className="h-11">
              {savingTpl ? "Saving…" : "Save template"}
            </Button>
            <Button variant="outline" onClick={resetTemplate} className="h-11">
              Reset to default
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Check-in / check-out emails</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the confirmation emails sent to the student and the guardian when a student clocks in or clocks out. The header image and signature above are reused.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {["{{studentName}}", "{{recipientName}}", "{{guardianName}}", "{{dayName}}", "{{date}}", "{{time}}", "{{action}}", "{{verb}}", "{{greeting}}"].map((t) => (
            <code key={t} className="rounded bg-muted px-1.5 py-0.5 font-mono">{t}</code>
          ))}
        </div>
        <div className="space-y-6 mt-4">
          {[
            { key: "clockin_student", title: "Clock-in — to student" },
            { key: "clockin_guardian", title: "Clock-in — to guardian" },
            { key: "clockout_student", title: "Clock-out — to student" },
            { key: "clockout_guardian", title: "Clock-out — to guardian" },
          ].map((g) => {
            const subjKey = `${g.key}_subject` as keyof typeof clockTpl;
            const bodyKey = `${g.key}_body` as keyof typeof clockTpl;
            return (
              <div key={g.key} className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold">{g.title}</h4>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={clockTpl[subjKey]}
                    onChange={(e) => setClockTpl((p) => ({ ...p, [subjKey]: e.target.value }))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={clockTpl[bodyKey]}
                    onChange={(e) => setClockTpl((p) => ({ ...p, [bodyKey]: e.target.value }))}
                    rows={6}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={saveClockTemplates} disabled={savingClock} className="h-11">
              {savingClock ? "Saving…" : "Save templates"}
            </Button>
            <Button variant="outline" onClick={resetClockTemplates} className="h-11">
              Reset to defaults
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2">
          <Sheet className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Google Sheets sync</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Mirror students, cohorts, and attendance to a Google Sheet you own. Share the sheet with the connected Google account before syncing.
        </p>
        <div className="space-y-3 mt-4">
          <div className="space-y-2">
            <Label>Spreadsheet URL or ID</Label>
            <Input
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="h-11"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSync} disabled={syncing} className="h-11">
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            {savedSheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${savedSheetId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open sheet <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {lastSync && (
            <p className="text-xs text-muted-foreground">
              Last synced {format(new Date(lastSync), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border p-5">
        <h3 className="text-base font-semibold">Change admin password</h3>
        <p className="text-sm text-muted-foreground mt-1">
          You will stay signed in on this device.
        </p>
        <form onSubmit={submit} className="space-y-3 mt-4">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              minLength={6}
              required
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-11 w-full">
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </section>
    </div>
  );
}