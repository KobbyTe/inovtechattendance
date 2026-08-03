import process from "node:process";

/** Provider-agnostic guardian messaging (SMS via Arkesel, WhatsApp via Meta Cloud API). */

export type MsgResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }
  | { skipped: string };

const DEFAULT_COUNTRY_CODE = "233"; // Ghana

/** Normalize a local/international number to bare E.164 digits (no plus). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = DEFAULT_COUNTRY_CODE + d.slice(1);
  else if (d.length <= 9) d = DEFAULT_COUNTRY_CODE + d;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

export const DEFAULT_ABSENCE_SMS =
  "Hi {{guardianName}}, {{studentName}} was not marked present at Inovtech STEM Center on {{dayName}}, {{date}}. Please contact the program team if unexpected.";

export function absenceSmsText(opts: {
  guardianName?: string | null;
  studentName: string;
  dayName: string;
  date: string;
  template?: string | null;
}): string {
  const vars = {
    guardianName: opts.guardianName?.trim() || "Guardian",
    studentName: opts.studentName,
    dayName: opts.dayName,
    date: opts.date,
  };
  return renderTemplate(opts.template?.trim() || DEFAULT_ABSENCE_SMS, vars).slice(0, 480);
}

/** SMS through Arkesel v2. Returns { skipped } when the API key isn't configured yet. */
export async function sendSms(opts: {
  to: string;
  message: string;
  senderId?: string | null;
}): Promise<MsgResult> {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) return { skipped: "ARKESEL_API_KEY not configured" };
  const to = normalizePhone(opts.to);
  if (!to) return { ok: false, error: `invalid phone number: ${opts.to}` };
  const sender = (opts.senderId?.trim() || "Inovtech").slice(0, 11);

  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({ sender, message: opts.message, recipients: [to] }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Arkesel ${res.status}: ${text.slice(0, 300)}` };
    let id: string | null = null;
    try {
      const json = JSON.parse(text) as {
        status?: string;
        data?: Array<{ id?: string; recipient?: string }>;
      };
      if (json.status && json.status !== "success") {
        return { ok: false, error: `Arkesel: ${text.slice(0, 300)}` };
      }
      id = json.data?.[0]?.id ?? null;
    } catch {
      /* non-JSON success body */
    }
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * WhatsApp through the Meta Cloud API. Uses an approved template when
 * `templateName` is set, otherwise falls back to a plain text message
 * (only delivers inside a 24h customer-service window).
 */
export async function sendWhatsApp(opts: {
  to: string;
  message: string;
  templateName?: string | null;
  templateLang?: string | null;
  templateParams?: string[];
}): Promise<MsgResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { skipped: "WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured" };
  }
  const to = normalizePhone(opts.to);
  if (!to) return { ok: false, error: `invalid phone number: ${opts.to}` };

  const body = opts.templateName?.trim()
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: opts.templateName.trim(),
          language: { code: opts.templateLang?.trim() || "en" },
          components: (opts.templateParams ?? []).length
            ? [
                {
                  type: "body",
                  parameters: (opts.templateParams ?? []).map((t) => ({
                    type: "text",
                    text: t,
                  })),
                },
              ]
            : [],
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: opts.message },
      };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `WhatsApp ${res.status}: ${text.slice(0, 300)}` };
    let id: string | null = null;
    try {
      const json = JSON.parse(text) as { messages?: Array<{ id?: string }> };
      id = json.messages?.[0]?.id ?? null;
    } catch {
      /* ignore */
    }
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type AdminClient = {
  from: (t: "notification_log") => {
    insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

export async function logNotification(
  admin: unknown,
  row: {
    student_id?: string | null;
    student_name?: string | null;
    channel: "sms" | "whatsapp";
    recipient: string;
    provider: string;
    kind?: string;
    date?: string | null;
    body?: string | null;
    status: "sent" | "failed" | "skipped";
    provider_message_id?: string | null;
    error?: string | null;
  },
): Promise<void> {
  const client = admin as AdminClient;
  await client.from("notification_log").insert({
    ...row,
    kind: row.kind ?? "absence",
    sent_at: row.status === "sent" ? new Date().toISOString() : null,
  });
}

/** Send absence alerts on every enabled channel and log each attempt. */
export async function notifyGuardianAbsence(
  admin: unknown,
  opts: {
    studentId: string;
    studentName: string;
    guardianName?: string | null;
    guardianPhone?: string | null;
    optOut?: boolean | null;
    dayName: string;
    date: string;
    settings: {
      sms_enabled?: boolean | null;
      whatsapp_enabled?: boolean | null;
      sms_sender_id?: string | null;
      absence_sms_template?: string | null;
      whatsapp_template_name?: string | null;
      whatsapp_template_lang?: string | null;
    };
  },
): Promise<{ sms: MsgResult | null; whatsapp: MsgResult | null }> {
  const s = opts.settings;
  const out: { sms: MsgResult | null; whatsapp: MsgResult | null } = {
    sms: null,
    whatsapp: null,
  };
  if (!s.sms_enabled && !s.whatsapp_enabled) return out;
  if (opts.optOut) return out;
  const phone = normalizePhone(opts.guardianPhone);
  if (!phone) return out;

  const message = absenceSmsText({
    guardianName: opts.guardianName,
    studentName: opts.studentName,
    dayName: opts.dayName,
    date: opts.date,
    template: s.absence_sms_template,
  });

  const record = async (
    channel: "sms" | "whatsapp",
    provider: string,
    result: MsgResult,
  ) => {
    await logNotification(admin, {
      student_id: opts.studentId,
      student_name: opts.studentName,
      channel,
      recipient: phone,
      provider,
      date: opts.date,
      body: message,
      status: "ok" in result ? (result.ok ? "sent" : "failed") : "skipped",
      provider_message_id: "ok" in result && result.ok ? result.id : null,
      error:
        "error" in result ? result.error : "skipped" in result ? result.skipped : null,
    });
  };

  if (s.sms_enabled) {
    out.sms = await sendSms({ to: phone, message, senderId: s.sms_sender_id });
    await record("sms", "arkesel", out.sms);
  }
  if (s.whatsapp_enabled) {
    out.whatsapp = await sendWhatsApp({
      to: phone,
      message,
      templateName: s.whatsapp_template_name,
      templateLang: s.whatsapp_template_lang,
      templateParams: [
        opts.guardianName?.trim() || "Guardian",
        opts.studentName,
        `${opts.dayName}, ${opts.date}`,
      ],
    });
    await record("whatsapp", "meta", out.whatsapp);
  }
  return out;
}