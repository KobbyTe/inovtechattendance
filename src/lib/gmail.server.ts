import process from "node:process";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64");
}

// RFC 2047 encoded-word for headers containing non-ASCII characters.
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${b64(value)}?=`;
}

// Split base64 into 76-char lines per RFC 2045.
function chunk76(s: string): string {
  return s.replace(/(.{76})/g, "$1\r\n");
}

function buildRaw(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
}): string {
  const boundary = `b_${Date.now().toString(36)}`;
  const headers: string[] = [`To: ${opts.to}`, `Subject: ${encodeHeader(opts.subject)}`];
  if (opts.fromName) headers.push(`From: ${encodeHeader(opts.fromName)}`);
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const textPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    chunk76(b64(opts.text)),
  ].join("\r\n");

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    chunk76(b64(opts.html)),
  ].join("\r\n");

  const mime = `${headers.join("\r\n")}\r\n\r\n${textPart}\r\n${htmlPart}\r\n--${boundary}--\r\n`;
  return b64url(mime);
}

export async function sendGmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAIL_API_KEY = process.env.GOOGLE_MAIL_API_KEY;
  if (!LOVABLE_API_KEY) return { ok: false, error: "LOVABLE_API_KEY not configured" };
  if (!GOOGLE_MAIL_API_KEY) return { ok: false, error: "GOOGLE_MAIL_API_KEY not configured" };

  const raw = buildRaw(opts);
  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Gmail ${res.status}: ${body.slice(0, 300)}` };
  }
  const json = (await res.json()) as { id: string };
  return { ok: true, id: json.id };
}

export function absenceEmail(opts: {
  guardianName?: string | null;
  studentName: string;
  dayName: string;
  date: string;
  subjectTemplate?: string | null;
  bodyTemplate?: string | null;
  headerImageUrl?: string | null;
  signature?: string | null;
}): { subject: string; html: string; text: string } {
  const greeting = opts.guardianName ? `Hello ${opts.guardianName},` : "Hello,";
  const vars: Record<string, string> = {
    guardianName: opts.guardianName ?? "",
    studentName: opts.studentName,
    dayName: opts.dayName,
    date: opts.date,
    greeting,
  };
  const render = (tpl: string) =>
    tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");

  const subjectTpl =
    opts.subjectTemplate?.trim() ||
    "Absence notice: {{studentName}} — {{dayName}}, {{date}}";
  const bodyTpl =
    opts.bodyTemplate?.trim() ||
    "{{greeting}}\n\nThis is to notify you that {{studentName}} was not marked present at the bootcamp meeting on {{dayName}}, {{date}}.\n\nIf this is unexpected, please contact the program team.";
  const signature = (opts.signature ?? "— Inovtech Student Attendance").trim();

  const subject = render(subjectTpl);
  const renderedBody = render(bodyTpl);
  const headerImageUrl = (opts.headerImageUrl ?? "").trim();

  const text = [renderedBody, signature].filter(Boolean).join("\n\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toHtmlParas = (s: string) =>
    esc(s)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

  const html = `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:680px">
    ${headerImageUrl ? `<div style="margin-bottom:16px"><img src="${esc(headerImageUrl)}" alt="" style="display:block;max-width:100%;height:auto;border:0;outline:none;text-decoration:none" /></div>` : ""}
    ${toHtmlParas(renderedBody)}
    <p style="color:#666;font-size:12px;margin-top:24px;white-space:pre-line">${esc(signature)}</p>
  </div>`;
  return { subject, html, text };
}

export function clockEventEmail(opts: {
  recipientName?: string | null;
  studentName: string;
  action: "in" | "out";
  dayName: string;
  date: string;
  time: string;
  audience: "student" | "guardian";
  subjectTemplate?: string | null;
  bodyTemplate?: string | null;
  headerImageUrl?: string | null;
  signature?: string | null;
}): { subject: string; html: string; text: string } {
  const verb = opts.action === "in" ? "checked in" : "checked out";
  const greeting = opts.recipientName ? `Hello ${opts.recipientName},` : "Hello,";
  const vars: Record<string, string> = {
    studentName: opts.studentName,
    recipientName: opts.recipientName ?? "",
    guardianName: opts.audience === "guardian" ? (opts.recipientName ?? "") : "",
    dayName: opts.dayName,
    date: opts.date,
    time: opts.time,
    action: opts.action === "in" ? "Clock in" : "Clock out",
    verb,
    greeting,
  };
  const render = (tpl: string) =>
    tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");

  const defaults = clockEmailDefaults(opts.action, opts.audience);
  const subject = render((opts.subjectTemplate?.trim() || defaults.subject));
  const renderedBody = render((opts.bodyTemplate?.trim() || defaults.body));

  const signature = (opts.signature ?? "— Inovtech Student Attendance").trim();
  const headerImageUrl = (opts.headerImageUrl ?? "").trim();

  const text = [renderedBody, signature].filter(Boolean).join("\n\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toHtmlParas = (s: string) =>
    esc(s)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

  const badgeBg = opts.action === "in" ? "#16a34a" : "#2563eb";
  const badgeText = opts.action === "in" ? "CLOCKED IN" : "CLOCKED OUT";

  const html = `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:680px">
    ${headerImageUrl ? `<div style="margin-bottom:16px"><img src="${esc(headerImageUrl)}" alt="" style="display:block;max-width:100%;height:auto;border:0;outline:none;text-decoration:none" /></div>` : ""}
    <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${badgeBg};color:#fff;font-size:12px;font-weight:bold;letter-spacing:0.5px;margin:8px 0 16px">${badgeText} • ${esc(opts.time)}</div>
    ${toHtmlParas(renderedBody)}
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:480px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:13px;width:120px">Student</td><td style="padding:10px 14px;font-size:14px">${esc(opts.studentName)}</td></tr>
      <tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:13px">Day</td><td style="padding:10px 14px;font-size:14px">${esc(opts.dayName)}</td></tr>
      <tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:13px">Date</td><td style="padding:10px 14px;font-size:14px">${esc(opts.date)}</td></tr>
      <tr><td style="padding:10px 14px;background:#f9fafb;color:#6b7280;font-size:13px">Time</td><td style="padding:10px 14px;font-size:14px">${esc(opts.time)}</td></tr>
    </table>
    <p style="color:#666;font-size:12px;margin-top:24px;white-space:pre-line">${esc(signature)}</p>
  </div>`;

  return { subject, html, text };
}

export function clockEmailDefaults(
  action: "in" | "out",
  audience: "student" | "guardian",
): { subject: string; body: string } {
  if (action === "in" && audience === "student") {
    return {
      subject: "You checked in at {{time}} — {{dayName}}, {{date}}",
      body: "{{greeting}}\n\nThis confirms that you checked in for the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.\n\nHave a great session!",
    };
  }
  if (action === "in" && audience === "guardian") {
    return {
      subject: "{{studentName}} checked in at {{time}} — {{dayName}}, {{date}}",
      body: "{{greeting}}\n\nThis is to let you know that {{studentName}} checked in for the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.",
    };
  }
  if (action === "out" && audience === "student") {
    return {
      subject: "You checked out at {{time}} — {{dayName}}, {{date}}",
      body: "{{greeting}}\n\nThis confirms that you checked out from the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.\n\nSee you next time!",
    };
  }
  return {
    subject: "{{studentName}} checked out at {{time}} — {{dayName}}, {{date}}",
    body: "{{greeting}}\n\nThis is to let you know that {{studentName}} checked out from the bootcamp meeting on {{dayName}}, {{date}} at {{time}}.",
  };
}