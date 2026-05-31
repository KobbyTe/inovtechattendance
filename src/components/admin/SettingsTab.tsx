import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { syncToGoogleSheets } from "@/lib/sheets.functions";
import { ExternalLink, RefreshCw, Sheet } from "lucide-react";
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

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("google_sheet_id,last_sheets_sync_at")
      .eq("singleton", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.google_sheet_id) {
          setSavedSheetId(data.google_sheet_id);
          setSheetInput(data.google_sheet_id);
        }
        if (data?.last_sheets_sync_at) setLastSync(data.last_sheets_sync_at);
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

  return (
    <div className="grid gap-6 max-w-2xl">
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