import process from "node:process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MEETING_DAYS } from "@/lib/attendance";
import { format } from "date-fns";

function getKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for QR signing");
  return `attendance-qr:${k}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(date: string): string {
  const sig = createHmac("sha256", getKey()).update(date).digest();
  return `${b64url(Buffer.from(date))}.${b64url(sig)}`;
}

export function generateQrToken(date: Date): {
  token: string;
  date: string;
  dayName: string;
} {
  const dayName = format(date, "EEEE");
  const dateStr = format(date, "yyyy-MM-dd");
  return { token: sign(dateStr), date: dateStr, dayName };
}

export function verifyQrToken(token: string): {
  valid: boolean;
  reason?: string;
  date?: string;
} {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "Invalid code" };
  }
  const [encDate, encSig] = token.split(".");
  let date: string;
  try {
    date = Buffer.from(encDate.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return { valid: false, reason: "Invalid code" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { valid: false, reason: "Invalid code" };

  const expected = sign(date).split(".")[1];
  const a = Buffer.from(encSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "Invalid code" };
  }

  const today = format(new Date(), "yyyy-MM-dd");
  if (date !== today) {
    return { valid: false, reason: "This QR code has expired. Ask the admin for today's code.", date };
  }
  const dayName = format(new Date(), "EEEE");
  if (!MEETING_DAYS.includes(dayName)) {
    return { valid: false, reason: "Today is not a meeting day.", date };
  }
  return { valid: true, date };
}