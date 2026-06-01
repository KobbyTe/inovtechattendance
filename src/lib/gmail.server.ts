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
}): { subject: string; html: string; text: string } {
  const greeting = opts.guardianName ? `Hello ${opts.guardianName},` : "Hello,";
  const subject = `Absence notice: ${opts.studentName} — ${opts.dayName}, ${opts.date}`;
  const text = `${greeting}

This is to notify you that ${opts.studentName} was not marked present at the Inovtech bootcamp meeting on ${opts.dayName}, ${opts.date}.

If this is unexpected, please contact the program team.

— Inovtech Student Attendance`;
  const html = `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px">
    <p>${greeting}</p>
    <p>This is to notify you that <strong>${opts.studentName}</strong> was not marked present at the Inovtech bootcamp meeting on <strong>${opts.dayName}, ${opts.date}</strong>.</p>
    <p>If this is unexpected, please contact the program team.</p>
    <p style="color:#666;font-size:12px;margin-top:24px">— Inovtech Student Attendance</p>
  </div>`;
  return { subject, html, text };
}