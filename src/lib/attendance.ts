import { format, differenceInMinutes, parseISO } from "date-fns";

export const MEETING_DAYS = ["Wednesday", "Thursday", "Friday"];

export function getDayName(d: Date = new Date()): string {
  return format(d, "EEEE");
}

export function isMeetingDay(d: Date = new Date()): boolean {
  return MEETING_DAYS.includes(getDayName(d));
}

export function todayDateStr(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

export function formatTime(iso: string): string {
  return format(parseISO(iso), "h:mm a");
}

export function formatDateLong(d: Date = new Date()): string {
  return format(d, "EEEE, MMMM d, yyyy");
}

export function formatDuration(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return "Still in";
  const mins = differenceInMinutes(parseISO(clockOut), parseISO(clockIn));
  if (mins < 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}