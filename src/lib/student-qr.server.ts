import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";

function getKey(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for student QR signing");
  return `student-qr:${k}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function sign(studentId: string): string {
  const norm = studentId.trim().toUpperCase();
  const sig = createHmac("sha256", getKey()).update(norm).digest();
  return `stu.${b64url(Buffer.from(norm))}.${b64url(sig)}`;
}

export function signStudentToken(studentId: string): string {
  return sign(studentId);
}

export function verifyStudentToken(token: string): {
  valid: boolean;
  studentId?: string;
  reason?: string;
} {
  if (!token || typeof token !== "string") return { valid: false, reason: "Invalid code" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "stu") return { valid: false, reason: "Not a student QR" };
  let studentId: string;
  try {
    studentId = b64urlDecode(parts[1]);
  } catch {
    return { valid: false, reason: "Invalid code" };
  }
  if (!/^[A-Z0-9_-]{1,64}$/.test(studentId)) return { valid: false, reason: "Invalid code" };
  const expected = sign(studentId).split(".")[2];
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "Invalid or tampered QR" };
  }
  return { valid: true, studentId };
}