## 1. Email header as an uploaded image

Replace the free-text "Header" field in Settings with an image upload.

**Storage**
- New migration: create a public storage bucket `email-assets` with public SELECT and admin-only INSERT/UPDATE/DELETE policies.
- Add column `email_header_image_url TEXT` to `app_settings` (keep `email_header` for backward compat, but UI stops writing to it).

**Settings UI (`SettingsTab.tsx`)**
- Replace the Header text input with a file picker (`accept="image/*"`).
- On file select:
  - Read natural width/height; reject if `width < 600 || width > 700 || height < 70 || height > 200` with a toast explaining the required size (600–700 px wide, 70–200 px tall).
  - Upload to `email-assets/headers/{timestamp}-{filename}` via `supabase.storage`.
  - Save the public URL into `app_settings.email_header_image_url`.
- Show a live preview of the current header image with a "Remove" button.

**Email rendering (`gmail.server.ts`)**
- `absenceEmail()` takes `headerImageUrl?: string` instead of `header` text.
- In the HTML template, render `<img src="..." width="..." style="display:block;max-width:100%;height:auto;border:0" alt="" />` at the top, no text fallback in HTML; the plain-text part just omits the header.

**Hook (`absence-check.ts`)**
- Read `email_header_image_url` and pass to `absenceEmail()`.

## 2. Daily-rotating QR code

The current `/attendance` page is a static URL. Switch to a signed daily token so a screenshot from a previous day no longer works.

**DB / secret**
- Add secret `ATTENDANCE_QR_SECRET` (random string) for HMAC signing — generated server-side.

**Server function `getAttendanceQrToken` (admin only)**
- Input: optional `date` (defaults to today, server timezone).
- Validates the date is a meeting day (Wed/Thu/Fri); otherwise returns `{ ok: false, reason }`.
- Returns `{ token, date, expiresAt }` where `token = base64url(date) + "." + hmacSHA256(date, secret)`.

**Attendance route (`/attendance`)**
- Now accepts `?t=<token>` query param.
- On load, calls a server function `verifyAttendanceToken({ token })` that:
  - Recomputes HMAC, checks token's embedded date equals today (server time), and that today is a meeting day.
  - Returns `{ valid: true }` or `{ valid: false, reason }`.
- If invalid/expired: show a friendly "This QR code has expired — ask the admin for today's code" screen; do NOT render the clock-in form.
- If valid: render the existing `ClockInForm`.

**Admin QR panel (`QRCodePanel.tsx`)**
- Replace the static URL with:
  - A date selector defaulting to today (restricted to meeting days, next ~14 days).
  - "Generate QR for {date}" button → calls `getAttendanceQrToken`.
  - Encode `${origin}/attendance?t=${token}` in the QR.
  - Show date, expiration ("Expires at end of {dayName}"), Download, Copy link.
- Optional UX: auto-generate today's QR on mount when today is a meeting day.

**Security notes**
- Token is bound to the day only, not to a device, so a student can still forward it within the same day — acceptable for a bootcamp roll call, much stronger than the current permanent link.
- Secret lives only on the server; verification is server-side; client never sees the secret.

## Files touched

- new migration: bucket + storage policies + `email_header_image_url` column
- `src/components/admin/SettingsTab.tsx` — image upload UI
- `src/lib/gmail.server.ts` — image-based header
- `src/routes/api/public/hooks/absence-check.ts` — pass new field
- `src/lib/attendance-qr.functions.ts` (new) — `getAttendanceQrToken`, `verifyAttendanceToken`
- `src/lib/attendance-qr.server.ts` (new) — HMAC helpers, reads `ATTENDANCE_QR_SECRET`
- `src/components/admin/QRCodePanel.tsx` — dynamic generation UI
- `src/routes/attendance.tsx` — token verification gate
- add secret `ATTENDANCE_QR_SECRET`

Confirm and I'll implement.
