import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";

/** Newsletter / announcement engine: audience resolution, rendering, batched dispatch. */

export type Audience = "current_students" | "alumni" | "all" | "custom";

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "program";
}

function unsubKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for unsubscribe signing");
  return `newsletter-unsub:${k}`;
}

export function unsubscribeToken(studentId: string): string {
  return createHmac("sha256", unsubKey())
    .update(studentId.trim().toUpperCase())
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(studentId: string, token: string): boolean {
  const expected = unsubscribeToken(studentId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from((token ?? "").trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function htmlToPlain(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function newsletterEmail(opts: {
  title: string;
  bodyHtml: string;
  flyerImageUrl?: string | null;
  programFormLink?: string | null;
  headerImageUrl?: string | null;
  signature?: string | null;
  landingUrl: string;
  unsubscribeUrl?: string | null;
  accentColor?: string | null;
}): { subject: string; html: string; text: string } {
  const accent = opts.accentColor?.trim() || "#2563eb";
  const header = (opts.headerImageUrl ?? "").trim();
  const flyer = (opts.flyerImageUrl ?? "").trim();
  const cta = (opts.programFormLink ?? "").trim();
  const signature = (opts.signature ?? "— Inovtech STEM Center").trim();

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.6;max-width:680px;margin:0 auto">
    ${header ? `<div style="margin-bottom:16px"><img src="${esc(header)}" alt="" style="display:block;max-width:100%;height:auto;border:0" /></div>` : ""}
    <div style="height:4px;background:${esc(accent)};border-radius:2px;margin-bottom:20px"></div>
    <h1 style="font-size:22px;margin:0 0 14px">${esc(opts.title)}</h1>
    <div style="font-size:15px">${opts.bodyHtml}</div>
    ${flyer ? `<div style="margin:22px 0"><img src="${esc(flyer)}" alt="${esc(opts.title)} flyer" style="display:block;width:100%;max-width:640px;height:auto;border-radius:10px;border:1px solid #e5e7eb" /></div>` : ""}
    ${
      cta
        ? `<div style="margin:26px 0"><a href="${esc(cta)}" style="display:inline-block;background:${esc(accent)};color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:8px;font-size:15px">Apply / Register now</a></div>`
        : ""
    }
    <p style="font-size:13px;color:#6b7280">View this online: <a href="${esc(opts.landingUrl)}" style="color:${esc(accent)}">${esc(opts.landingUrl)}</a></p>
    <p style="color:#666;font-size:12px;margin-top:22px;white-space:pre-line">${esc(signature)}</p>
    ${
      opts.unsubscribeUrl
        ? `<p style="color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:18px">You are receiving this because you opted in to Inovtech program updates. <a href="${esc(opts.unsubscribeUrl)}" style="color:#9ca3af">Unsubscribe</a>.</p>`
        : ""
    }
  </div>`;

  const text = [
    opts.title,
    htmlToPlain(opts.bodyHtml),
    cta ? `Apply / Register: ${cta}` : "",
    `Details: ${opts.landingUrl}`,
    signature,
    opts.unsubscribeUrl ? `Unsubscribe: ${opts.unsubscribeUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: opts.title, html, text };
}

export function newsletterSms(opts: { title: string; landingUrl: string }): string {
  return `Inovtech STEM Center: ${opts.title}. Details & registration: ${opts.landingUrl}`.slice(
    0,
    300,
  );
}

type Row = Record<string, unknown>;
type Admin = {
  from: (t: string) => any;
};

export function landingUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/programs/${slug}`;
}

export function unsubscribeUrl(origin: string, studentId: string): string {
  return `${origin.replace(/\/+$/, "")}/unsubscribe?sid=${encodeURIComponent(
    studentId,
  )}&t=${unsubscribeToken(studentId)}`;
}

/** Resolve an announcement's audience into deduped recipient rows (not yet inserted). */
export async function resolveRecipients(
  admin: Admin,
  ann: {
    id: string;
    target_audience: Audience;
    audience_filter: { cohort_codes?: string[] } | null;
  },
  channels: { email: boolean; sms: boolean; whatsapp: boolean },
): Promise<{
  rows: Array<{
    announcement_id: string;
    student_id: string;
    recipient_type: "student" | "guardian";
    channel: "email" | "sms" | "whatsapp";
    contact_value: string;
  }>;
  skippedNoConsent: number;
  totalStudents: number;
}> {
  const { data: cohorts } = await admin
    .from("cohorts")
    .select("id,code,status");
  const cohortList = (cohorts ?? []) as Array<{ id: string; code: string; status: string }>;

  let allowedCohortIds: string[] | null = null;
  if (ann.target_audience === "current_students") {
    allowedCohortIds = cohortList
      .filter((c) => c.status === "active" || c.status === "upcoming")
      .map((c) => c.id);
  } else if (ann.target_audience === "alumni") {
    allowedCohortIds = cohortList.filter((c) => c.status === "ended").map((c) => c.id);
  } else if (ann.target_audience === "custom") {
    const codes = (ann.audience_filter?.cohort_codes ?? []).map((c) => c.toUpperCase());
    allowedCohortIds = cohortList
      .filter((c) => codes.includes((c.code ?? "").toUpperCase()))
      .map((c) => c.id);
  }

  let q = admin
    .from("students")
    .select(
      "student_id,full_name,student_email,guardian_email,guardian_phone,marketing_opt_in,cohort_id",
    );
  if (allowedCohortIds) {
    if (allowedCohortIds.length === 0)
      return { rows: [], skippedNoConsent: 0, totalStudents: 0 };
    q = q.in("cohort_id", allowedCohortIds);
  }
  const { data: students } = await q;
  const list = (students ?? []) as Array<{
    student_id: string;
    student_email: string | null;
    guardian_email: string | null;
    guardian_phone: string | null;
    marketing_opt_in: boolean;
  }>;

  const { normalizePhone } = await import("./messaging.server");
  const rows: Array<{
    announcement_id: string;
    student_id: string;
    recipient_type: "student" | "guardian";
    channel: "email" | "sms" | "whatsapp";
    contact_value: string;
  }> = [];
  const seen = new Set<string>();
  let skippedNoConsent = 0;

  const push = (
    student_id: string,
    recipient_type: "student" | "guardian",
    channel: "email" | "sms" | "whatsapp",
    contact_value: string,
  ) => {
    const key = `${channel}:${contact_value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ announcement_id: ann.id, student_id, recipient_type, channel, contact_value });
  };

  for (const s of list) {
    if (!s.marketing_opt_in) {
      skippedNoConsent++;
      continue;
    }
    if (channels.email) {
      if (s.student_email?.trim()) push(s.student_id, "student", "email", s.student_email.trim());
      if (s.guardian_email?.trim())
        push(s.student_id, "guardian", "email", s.guardian_email.trim());
    }
    const phone = normalizePhone(s.guardian_phone);
    if (phone && channels.sms) push(s.student_id, "guardian", "sms", phone);
    if (phone && channels.whatsapp) push(s.student_id, "guardian", "whatsapp", phone);
  }

  return { rows, skippedNoConsent, totalStudents: list.length };
}

/**
 * Send one batch of pending recipients. Returns counts plus `remaining`
 * so the cron webhook can keep calling until the queue drains — never a
 * single synchronous loop over the whole audience.
 */
export async function dispatchAnnouncementBatch(
  admin: Admin,
  announcementId: string,
  batchSize = 25,
  origin = "https://inovtechattendance.lovable.app",
): Promise<{ sent: number; failed: number; remaining: number; done: boolean }> {
  const { data: ann } = await admin
    .from("announcements")
    .select("*")
    .eq("id", announcementId)
    .maybeSingle();
  if (!ann) return { sent: 0, failed: 0, remaining: 0, done: true };
  const a = ann as Row & {
    id: string;
    title: string;
    body_html: string;
    body_plain: string;
    slug: string;
    flyer_image_url: string | null;
    program_form_link: string | null;
    cohort_id: string | null;
  };

  const { data: settings } = await admin
    .from("app_settings")
    .select(
      "email_header_image_url,email_signature,sms_sender_id,whatsapp_template_name,whatsapp_template_lang",
    )
    .eq("singleton", true)
    .maybeSingle();
  const s = (settings ?? {}) as Record<string, string | null>;

  let accent: string | null = null;
  if (a.cohort_id) {
    const { data: c } = await admin
      .from("cohorts")
      .select("color")
      .eq("id", a.cohort_id)
      .maybeSingle();
    accent = (c as { color?: string } | null)?.color ?? null;
  }

  const { data: pending } = await admin
    .from("announcement_recipients")
    .select("id,student_id,recipient_type,channel,contact_value")
    .eq("announcement_id", announcementId)
    .eq("status", "pending")
    .limit(batchSize);
  const batch = (pending ?? []) as Array<{
    id: string;
    student_id: string | null;
    channel: "email" | "sms" | "whatsapp";
    contact_value: string;
  }>;

  const page = landingUrl(origin, a.slug);
  const { sendGmail } = await import("./gmail.server");
  const { sendSms, sendWhatsApp } = await import("./messaging.server");

  let sent = 0;
  let failed = 0;

  for (const r of batch) {
    let ok = false;
    let id: string | null = null;
    let error: string | null = null;
    try {
      if (r.channel === "email") {
        const mail = newsletterEmail({
          title: a.title,
          bodyHtml: a.body_html,
          flyerImageUrl: a.flyer_image_url,
          programFormLink: a.program_form_link,
          headerImageUrl: s.email_header_image_url ?? null,
          signature: s.email_signature ?? null,
          landingUrl: page,
          unsubscribeUrl: r.student_id ? unsubscribeUrl(origin, r.student_id) : null,
          accentColor: accent,
        });
        const res = await sendGmail({
          to: r.contact_value,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
        ok = res.ok;
        id = res.ok ? res.id : null;
        error = res.ok ? null : res.error;
      } else if (r.channel === "sms") {
        const res = await sendSms({
          to: r.contact_value,
          message: newsletterSms({ title: a.title, landingUrl: page }),
          senderId: s.sms_sender_id ?? null,
        });
        ok = "ok" in res && res.ok;
        id = "ok" in res && res.ok ? res.id : null;
        error = "error" in res ? res.error : "skipped" in res ? res.skipped : null;
      } else {
        const res = await sendWhatsApp({
          to: r.contact_value,
          message: newsletterSms({ title: a.title, landingUrl: page }),
          templateName: s.whatsapp_template_name ?? null,
          templateLang: s.whatsapp_template_lang ?? null,
          templateParams: [a.title, page],
        });
        ok = "ok" in res && res.ok;
        id = "ok" in res && res.ok ? res.id : null;
        error = "error" in res ? res.error : "skipped" in res ? res.skipped : null;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    if (ok) sent++;
    else failed++;

    await admin
      .from("announcement_recipients")
      .update({
        status: ok ? "sent" : "failed",
        provider_message_id: id,
        error,
        sent_at: ok ? new Date().toISOString() : null,
      })
      .eq("id", r.id);
  }

  const { count } = await admin
    .from("announcement_recipients")
    .select("id", { count: "exact", head: true })
    .eq("announcement_id", announcementId)
    .eq("status", "pending");
  const remaining = count ?? 0;
  if (remaining === 0) {
    await admin.from("announcements").update({ status: "sent" }).eq("id", announcementId);
  }
  return { sent, failed, remaining, done: remaining === 0 };
}

/** Cron pass: start due scheduled announcements and keep sending ones in flight. */
export async function runAnnouncementQueue(
  admin: Admin,
  origin?: string,
): Promise<{ processed: Array<{ id: string; sent: number; failed: number; remaining: number }> }> {
  const nowIso = new Date().toISOString();
  await admin
    .from("announcements")
    .update({ status: "sending" })
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso);

  const { data: inFlight } = await admin
    .from("announcements")
    .select("id")
    .eq("status", "sending")
    .limit(5);
  const processed: Array<{ id: string; sent: number; failed: number; remaining: number }> = [];
  for (const row of (inFlight ?? []) as Array<{ id: string }>) {
    const res = await dispatchAnnouncementBatch(admin, row.id, 25, origin);
    processed.push({ id: row.id, sent: res.sent, failed: res.failed, remaining: res.remaining });
  }
  return { processed };
}
