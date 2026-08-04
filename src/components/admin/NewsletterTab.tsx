import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteAnnouncement,
  dispatchAnnouncementNow,
  previewAnnouncementAudience,
  saveAnnouncement,
  sendAnnouncement,
} from "@/lib/announcements.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ExternalLink,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type Audience = "current_students" | "alumni" | "all" | "custom";

type Announcement = {
  id: string;
  title: string;
  body_html: string;
  slug: string;
  flyer_image_url: string | null;
  program_form_link: string | null;
  cohort_id: string | null;
  target_audience: Audience;
  audience_filter: { cohort_codes?: string[] } | null;
  status: "draft" | "scheduled" | "sending" | "sent";
  scheduled_at: string | null;
  created_at: string;
};

type Form = {
  id?: string;
  title: string;
  bodyHtml: string;
  flyerImageUrl: string;
  programFormLink: string;
  cohortId: string;
  targetAudience: Audience;
  cohortCodes: string;
  scheduledAt: string;
};

const emptyForm = (): Form => ({
  title: "",
  bodyHtml: "",
  flyerImageUrl: "",
  programFormLink: "",
  cohortId: "",
  targetAudience: "all",
  cohortCodes: "",
  scheduledAt: "",
});

const AUDIENCE_LABEL: Record<Audience, string> = {
  current_students: "Current students (active & upcoming cohorts)",
  alumni: "Alumni (ended cohorts)",
  all: "Everyone on the roster",
  custom: "Specific cohorts",
};

const STATUS_STYLE: Record<Announcement["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-accent text-primary",
  sending: "bg-primary/15 text-primary",
  sent: "bg-primary text-primary-foreground",
};

export function NewsletterTab() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [cohorts, setCohorts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [stats, setStats] = useState<Record<string, { sent: number; failed: number; pending: number }>>(
    {},
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [channels, setChannels] = useState({ email: true, sms: false, whatsapp: false });
  const [audience, setAudience] = useState<{
    total: number;
    byChannel: Record<string, number>;
    skippedNoConsent: number;
    totalStudents: number;
  } | null>(null);

  const save = useServerFn(saveAnnouncement);
  const send = useServerFn(sendAnnouncement);
  const dispatchMore = useServerFn(dispatchAnnouncementNow);
  const remove = useServerFn(deleteAnnouncement);
  const preview = useServerFn(previewAnnouncementAudience);

  async function load() {
    const [{ data: anns }, { data: cs }, { data: recips }] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("cohorts").select("id,name,code").order("created_at", { ascending: false }),
      supabase.from("announcement_recipients").select("announcement_id,status"),
    ]);
    setRows((anns ?? []) as unknown as Announcement[]);
    setCohorts((cs ?? []) as Array<{ id: string; name: string; code: string }>);
    const agg: Record<string, { sent: number; failed: number; pending: number }> = {};
    for (const r of (recips ?? []) as Array<{ announcement_id: string; status: string }>) {
      const b = (agg[r.announcement_id] ??= { sent: 0, failed: 0, pending: 0 });
      if (r.status === "sent") b.sent++;
      else if (r.status === "failed") b.failed++;
      else b.pending++;
    }
    setStats(agg);
  }

  useEffect(() => {
    void load();
  }, []);

  const codeList = useMemo(
    () =>
      form.cohortCodes
        .split(/[,\s]+/)
        .map((c) => c.trim())
        .filter(Boolean),
    [form.cohortCodes],
  );

  async function refreshAudience() {
    try {
      const res = await preview({
        data: {
          targetAudience: form.targetAudience,
          cohortCodes: codeList,
          channels,
        },
      });
      setAudience(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve audience");
    }
  }

  async function uploadFlyer(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `flyers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("email-assets")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("email-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, flyerImageUrl: data.publicUrl }));
      toast.success("Flyer uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(alsoSend: boolean) {
    if (form.title.trim().length < 3) return toast.error("Give the announcement a title");
    if (!form.bodyHtml.trim()) return toast.error("Write the announcement body");
    setBusy(true);
    try {
      const saved = await save({
        data: {
          id: form.id,
          title: form.title.trim(),
          bodyHtml: form.bodyHtml.trim(),
          flyerImageUrl: form.flyerImageUrl.trim() || null,
          programFormLink: form.programFormLink.trim() || null,
          cohortId: form.cohortId || null,
          targetAudience: form.targetAudience,
          cohortCodes: codeList,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        },
      });
      if (alsoSend) {
        const res = await send({ data: { id: saved.id, channels } });
        if (!res.ok) toast.error(res.error ?? "Send failed");
        else
          toast.success(
            `Queued ${res.queued} recipient(s) — ${res.sent} sent, ${res.remaining} remaining`,
          );
      } else {
        toast.success(form.scheduledAt ? "Scheduled" : "Draft saved");
      }
      setOpen(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendExisting(a: Announcement) {
    setBusy(true);
    try {
      const res = await send({ data: { id: a.id, channels } });
      if (!res.ok) toast.error(res.error ?? "Send failed");
      else toast.success(`${res.sent} sent, ${res.remaining} remaining`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function drain(a: Announcement) {
    setBusy(true);
    try {
      const res = await dispatchMore({ data: { id: a.id } });
      toast.success(`${res.sent} sent, ${res.remaining} remaining`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function edit(a: Announcement) {
    setForm({
      id: a.id,
      title: a.title,
      bodyHtml: a.body_html,
      flyerImageUrl: a.flyer_image_url ?? "",
      programFormLink: a.program_form_link ?? "",
      cohortId: a.cohort_id ?? "",
      targetAudience: a.target_audience,
      cohortCodes: (a.audience_filter?.cohort_codes ?? []).join(", "),
      scheduledAt: a.scheduled_at ? a.scheduled_at.slice(0, 16) : "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Newsletter
          </h2>
          <p className="text-xs text-muted-foreground">
            Announce new programs and cohorts to students, alumni and guardians.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              onClick={() => {
                setForm(emptyForm());
                setAudience(null);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{form.id ? "Edit announcement" : "New announcement"}</SheetTitle>
            </SheetHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Title / subject</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Robotics Cohort 5 — applications now open"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea
                  rows={9}
                  value={form.bodyHtml}
                  onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                  placeholder="<p>Hi there,</p><p>Our next cohort starts <b>March 3rd</b>…</p>"
                />
                <p className="text-[11px] text-muted-foreground">
                  Basic HTML supported (&lt;p&gt;, &lt;b&gt;, &lt;a&gt;, &lt;ul&gt;). A plain-text
                  version is generated automatically for SMS and text-only clients.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Flyer image</Label>
                {form.flyerImageUrl && (
                  <img
                    src={form.flyerImageUrl}
                    alt="Flyer preview"
                    className="w-full rounded-lg border border-border"
                  />
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFlyer(f);
                    }}
                  />
                  {form.flyerImageUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, flyerImageUrl: "" })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {uploading && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Uploading…
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Registration / form link</Label>
                <Input
                  value={form.programFormLink}
                  onChange={(e) => setForm({ ...form, programFormLink: e.target.value })}
                  placeholder="https://forms.gle/…"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Audience</Label>
                  <Select
                    value={form.targetAudience}
                    onValueChange={(v) => setForm({ ...form, targetAudience: v as Audience })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
                        <SelectItem key={a} value={a}>
                          {AUDIENCE_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Brand colour from cohort (optional)</Label>
                  <Select
                    value={form.cohortId || "none"}
                    onValueChange={(v) => setForm({ ...form, cohortId: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      {cohorts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.targetAudience === "custom" && (
                <div className="space-y-1.5">
                  <Label>Cohort codes</Label>
                  <Input
                    value={form.cohortCodes}
                    onChange={(e) => setForm({ ...form, cohortCodes: e.target.value })}
                    placeholder="RB-2026-01, AI-2026-02"
                  />
                </div>
              )}

              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Channels
                </p>
                {(
                  [
                    ["email", "Email (students + guardians)"],
                    ["sms", "SMS to guardians"],
                    ["whatsapp", "WhatsApp to guardians"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-sm font-normal">{label}</Label>
                    <Switch
                      checked={channels[key]}
                      onCheckedChange={(v) => setChannels({ ...channels, [key]: v })}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>Schedule (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave empty to save as a draft or send immediately.
                </p>
              </div>

              <div className="rounded-lg bg-accent/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Audience preview
                  </p>
                  <Button variant="outline" size="sm" onClick={refreshAudience}>
                    Check
                  </Button>
                </div>
                {audience && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{audience.total}</span>{" "}
                    message(s) across {audience.totalStudents} student record(s) —{" "}
                    {Object.entries(audience.byChannel)
                      .map(([c, n]) => `${n} ${c}`)
                      .join(", ") || "none"}
                    . {audience.skippedNoConsent} skipped (no marketing opt-in).
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" disabled={busy} onClick={() => submit(false)}>
                  Save {form.scheduledAt ? "schedule" : "draft"}
                </Button>
                <Button disabled={busy} onClick={() => submit(true)} className="flex-1">
                  <Send className="h-4 w-4 mr-1" /> Save & send now
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No announcements yet. Create one to promote your next cohort.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const st = stats[a.id] ?? { sent: 0, failed: 0, pending: 0 };
            return (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{a.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {AUDIENCE_LABEL[a.target_audience]} ·{" "}
                      {a.scheduled_at
                        ? `scheduled ${format(parseISO(a.scheduled_at), "MMM d, HH:mm")}`
                        : format(parseISO(a.created_at), "MMM d, yyyy")}
                    </p>
                    {(st.sent || st.failed || st.pending) > 0 && (
                      <p className="mt-1 text-xs">
                        <span className="text-primary font-medium">{st.sent} sent</span>
                        {st.pending > 0 && (
                          <span className="text-muted-foreground"> · {st.pending} pending</span>
                        )}
                        {st.failed > 0 && (
                          <span className="text-destructive"> · {st.failed} failed</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {a.status === "sent" && (
                      <a
                        href={`/programs/${a.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-muted-foreground hover:text-foreground"
                        aria-label="Open public page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {a.status === "sending" && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => drain(a)}>
                        Continue sending
                      </Button>
                    )}
                    {(a.status === "draft" || a.status === "scheduled") && (
                      <>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => sendExisting(a)}
                        >
                          <Send className="h-4 w-4 mr-1" /> Send
                        </Button>
                        <button
                          onClick={() => edit(a)}
                          className="p-2 text-muted-foreground hover:text-foreground"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            await remove({ data: { id: a.id } });
                            toast.success("Deleted");
                            await load();
                          }}
                          className="p-2 text-muted-foreground hover:text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
