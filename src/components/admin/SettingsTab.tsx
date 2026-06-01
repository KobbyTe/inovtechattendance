import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { syncToGoogleSheets } from "@/lib/sheets.functions";
import { ExternalLink, Mail, RefreshCw, Sheet } from "lucide-react";
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

  const [emailSubject, setEmailSubject] = useState(DEFAULT_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_BODY);
  const [emailHeader, setEmailHeader] = useState("");
  const [emailSignature, setEmailSignature] = useState(DEFAULT_SIGNATURE);
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("google_sheet_id,last_sheets_sync_at,email_subject,email_body,email_header,email_signature")
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
        if (data?.email_header != null) setEmailHeader(data.email_header);
        if (data?.email_signature) setEmailSignature(data.email_signature);
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
      email_header: emailHeader,
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
    setEmailHeader("");
    setEmailSignature(DEFAULT_SIGNATURE);
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
            <Label>Header (optional)</Label>
            <Input
              value={emailHeader}
              onChange={(e) => setEmailHeader(e.target.value)}
              placeholder="e.g. Inovtech Bootcamp — Attendance"
              className="h-11"
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