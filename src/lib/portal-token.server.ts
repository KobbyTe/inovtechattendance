import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";

/**
 * Signed, non-guessable tokens for the student/guardian payment portal.
 * The token carries only the public student_id; everything else is fetched
 * server-side, so a leaked link exposes one student's invoice list at most.
 */
function getKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for portal signing");
  return `pay-portal:${k}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function sig(studentId: string): string {
  return b64url(createHmac("sha256", getKey()).update(studentId).digest());
}

export function signPortalToken(studentId: string): string {
  const norm = studentId.trim().toUpperCase();
  return `pay.${b64url(Buffer.from(norm))}.${sig(norm)}`;
}

export function verifyPortalToken(token: string): {
  valid: boolean;
  studentId?: string;
  reason?: string;
} {
  if (!token || typeof token !== "string") return { valid: false, reason: "Invalid link" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "pay") return { valid: false, reason: "Invalid link" };
  let studentId: string;
  try {
    studentId = b64urlDecode(parts[1] as string);
  } catch {
    return { valid: false, reason: "Invalid link" };
  }
  if (!/^[A-Z0-9_-]{1,64}$/.test(studentId)) return { valid: false, reason: "Invalid link" };
  const a = Buffer.from(parts[2] as string);
  const b = Buffer.from(sig(studentId));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "This link is invalid or has been tampered with" };
  }
  return { valid: true, studentId };
}
