import process from "node:process";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRaw(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
}): string {
  const boundary = `b_${Date.now().toString(36)}`;
  const fromHeader = opts.fromName ? `From: ${opts.fromName}\r\n` : "";
  const mime = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    fromHeader.trim(),
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    opts.text,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    opts.html,
    "",
    `--${boundary}--`,
  ]
    .filter((l) => l !== "")
    .join("\r\n");
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
  header?: string | null;
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
  const header = (opts.header ?? "").trim();
  const signature = (opts.signature ?? "— Inovtech Student Attendance").trim();

  const subject = render(subjectTpl);
  const renderedBody = render(bodyTpl);
  const renderedHeader = header ? render(header) : "";

  const text = [renderedHeader, renderedBody, signature].filter(Boolean).join("\n\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const toHtmlParas = (s: string) =>
    esc(s)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

  const html = `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px">
    ${renderedHeader ? `<div style="font-weight:600;margin-bottom:12px">${esc(renderedHeader)}</div>` : ""}
    ${toHtmlParas(renderedBody)}
    <p style="color:#666;font-size:12px;margin-top:24px;white-space:pre-line">${esc(signature)}</p>
  </div>`;
  return { subject, html, text };
}