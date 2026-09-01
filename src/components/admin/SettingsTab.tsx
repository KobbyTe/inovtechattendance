import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { syncToGoogleSheets } from "@/lib/sheets.functions";
import { sendTestGuardianMessage } from "@/lib/messaging.functions";
import { ExternalLink, ImagePlus, Mail, MessageSquare, RefreshCw, Sheet, Trash2 } from "lucide-react";
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
  const DEFAULT_SMS =
    "Hi {{guardianName}}, {{studentName}} was not marked present at Inovtech STEM Center on {{dayName}}, {{date}}. Please contact the program team if unexpected.";
  const [msg, setMsg] = useState({
    sms_enabled: false,
    whatsapp_enabled: false,
    sms_sender_id: "Inovtech",
    absence_sms_template: DEFAULT_SMS,
    whatsapp_template_name: "",
    whatsapp_template_lang: "en",
  });
  const [savingMsg, setSavingMsg] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState<"sms" | "whatsapp" | null>(null);
  const testMsgFn = useServerFn(sendTestGuardianMessage);

  const PAY_DEFAULTS = {
    payment_notify_enabled: true,
    payment_reminder_days_before: 3,
    payment_overdue_cadence: "1, 7, 14",
    payment_receipt_subject: "Payment received — {{amount}} for {{installment}}",
    payment_receipt_body:
      "{{greeting}}\n\nWe have received {{amount}} for {{installment}} ({{planName}}).\n\nRemaining balance on this installment: {{balance}}.\nPaid on {{paidAt}} via {{channel}}.\n\nYour receipt is attached as a PDF.",
    payment_reminder_subject: "Reminder: {{installment}} of {{balance}} is due {{dueDate}}",
    payment_reminder_body:
      "{{greeting}}\n\nThis is a reminder that {{installment}} ({{planName}}) of {{balance}} is due on {{dueDate}}.\n\nYou can pay online using this link:\n{{payLink}}",
    payment_overdue_subject: "Overdue: {{installment}} — {{balance}} outstanding",
    payment_overdue_body:
      "{{greeting}}\n\n{{installment}} ({{planName}}) of {{balance}} was due on {{dueDate}} and is now {{daysOverdue}} day(s) overdue.\n\nYou can settle it online here:\n{{payLink}}\n\nIf you have already paid, please ignore this message.",
    payment_receipt_sms:
      "Inovtech: payment of {{amount}} received for {{installment}}. Balance: {{balance}}. Thank you.",
    payment_reminder_sms:
      "Inovtech: {{installment}} of {{balance}} for {{studentName}} is due on {{dueDate}}. Pay: {{payLink}}",
    payment_overdue_sms:
      "Inovtech: {{installment}} of {{balance}} for {{studentName}} was due {{dueDate}} ({{daysOverdue}} day(s) overdue). Pay: {{payLink}}",
    whatsapp_payment_received_template: "",
    whatsapp_payment_reminder_template: "",
    whatsapp_payment_overdue_template: "",
  };
  const [pay, setPay] = useState(PAY_DEFAULTS);
  const [savingPay, setSavingPay] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const sweepFn = useServerFn(runPaymentReminderSweepNow);

  const [savingTpl, setSavingTpl] = useState(false);
  const [savingClock, setSavingClock] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    supabase
      .from("app_settings")
      .select(
        "google_sheet_id,last_sheets_sync_at,email_subject,email_body,email_header_image_url,email_signature,clockin_student_subject,clockin_student_body,clockin_guardian_subject,clockin_guardian_body,clockout_student_subject,clockout_student_body,clockout_guardian_subject,clockout_guardian_body,sms_enabled,whatsapp_enabled,sms_sender_id,absence_sms_template,whatsapp_template_name,whatsapp_template_lang",
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
          setMsg((prev) => ({
            sms_enabled: data.sms_enabled ?? prev.sms_enabled,
            whatsapp_enabled: data.whatsapp_enabled ?? prev.whatsapp_enabled,
            sms_sender_id: data.sms_sender_id ?? prev.sms_sender_id,
            absence_sms_template: data.absence_sms_template ?? prev.absence_sms_template,
            whatsapp_template_name: data.whatsapp_template_name ?? prev.whatsapp_template_name,
            whatsapp_template_lang: data.whatsapp_template_lang ?? prev.whatsapp_template_lang,
          }));
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

  async function saveMessaging() {
    setSavingMsg(true);
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();
    const payload = {
      singleton: true,
      ...msg,
      sms_sender_id: msg.sms_sender_id.trim() || null,
      whatsapp_template_name: msg.whatsapp_template_name.trim() || null,
      whatsapp_template_lang: msg.whatsapp_template_lang.trim() || "en",
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("app_settings").update(payload).eq("id", existing.id)
      : await supabase.from("app_settings").insert(payload);
    setSavingMsg(false);
    if (error) return toast.error(error.message);
    toast.success("SMS / WhatsApp settings saved");
  }

  async function sendTest(channel: "sms" | "whatsapp") {
    if (!testPhone.trim()) return toast.error("Enter a phone number to test");
    setTesting(channel);
    try {
      const res = await testMsgFn({ data: { channel, phone: testPhone.trim() } });
      if (res.ok) toast.success(`Test ${channel === "sms" ? "SMS" : "WhatsApp"} sent to ${res.to}`);
      else
        toast.error(
          "needsCredentials" in res && res.needsCredentials
            ? `Provider not connected yet — ${res.error}`
            : res.error,
        );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(null);
    }
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
    if (dims.w < 600 || dims.w > 1600 || dims.h < 70 || dims.h > 500) {
      return toast.error(
        `Image must be 600–1600 px wide and 70–500 px tall. Yours is ${dims.w}×${dims.h}.`,
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
              Upload a banner image. Recommended size: 600–1600 px wide, 70–500 px tall.
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
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Guardian SMS &amp; WhatsApp alerts</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Send absence alerts to guardian phone numbers alongside email. SMS goes out through
          Arkesel; WhatsApp through the Meta Cloud API using an approved template.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {["{{guardianName}}", "{{studentName}}", "{{dayName}}", "{{date}}"].map((t) => (
            <code key={t} className="rounded bg-muted px-1.5 py-0.5 font-mono">{t}</code>
          ))}
        </div>
        <div className="space-y-4 mt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={msg.sms_enabled}
              onChange={(e) => setMsg({ ...msg, sms_enabled: e.target.checked })}
            />
            Enable SMS absence alerts (Arkesel)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={msg.whatsapp_enabled}
              onChange={(e) => setMsg({ ...msg, whatsapp_enabled: e.target.checked })}
            />
            Enable WhatsApp absence alerts (Meta)
          </label>
          <div className="space-y-2">
            <Label>SMS sender ID</Label>
            <Input
              value={msg.sms_sender_id}
              maxLength={11}
              onChange={(e) => setMsg({ ...msg, sms_sender_id: e.target.value })}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Max 11 characters, must be approved with Arkesel.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Absence message</Label>
            <Textarea
              value={msg.absence_sms_template}
              onChange={(e) => setMsg({ ...msg, absence_sms_template: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {msg.absence_sms_template.length} characters — SMS is billed per 160 characters.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>WhatsApp template name</Label>
              <Input
                value={msg.whatsapp_template_name}
                placeholder="absence_notice"
                onChange={(e) => setMsg({ ...msg, whatsapp_template_name: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Template language</Label>
              <Input
                value={msg.whatsapp_template_lang}
                placeholder="en"
                onChange={(e) => setMsg({ ...msg, whatsapp_template_lang: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
          <Button onClick={saveMessaging} disabled={savingMsg} className="h-11">
            {savingMsg ? "Saving…" : "Save messaging settings"}
          </Button>
          <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
            <h4 className="text-sm font-semibold">Send a test message</h4>
            <Input
              type="tel"
              value={testPhone}
              placeholder="024 123 4567"
              onChange={(e) => setTestPhone(e.target.value)}
              className="h-11"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-11"
                disabled={testing !== null}
                onClick={() => sendTest("sms")}
              >
                {testing === "sms" ? "Sending…" : "Test SMS"}
              </Button>
              <Button
                variant="outline"
                className="h-11"
                disabled={testing !== null}
                onClick={() => sendTest("whatsapp")}
              >
                {testing === "whatsapp" ? "Sending…" : "Test WhatsApp"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Needs the Arkesel API key (SMS) and Meta WhatsApp token + phone number ID. Until
              those are added, alerts are skipped and logged instead of failing the absence run.
            </p>
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