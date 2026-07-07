## 1. Permanent per-student QR code

Every student gets a fixed, signed QR that encodes their student ID. Kiosk accepts these as a one-scan clock in/out (no daily QR + ID typing required).

**Signing (`src/lib/student-qr.server.ts`)**

- `signStudentToken(studentId)` → HMAC-SHA256 over `studentId` using `SUPABASE_SERVICE_ROLE_KEY` (same key path already used by `attendance-qr.server.ts`). Token format: `stu.<b64url(studentId)>.<b64url(sig)>`. No expiry — permanent.
- `verifyStudentToken(token)` → timing-safe compare, returns `{ valid, studentId }`.

**Server fns (`src/lib/student-qr.functions.ts`)**

- `getStudentQrToken({ studentId })` — admin-only (`requireSupabaseAuth` + `has_role admin`); returns token + a URL `${origin}/kiosk?s=<token>`.
- `kioskClockWithStudentToken({ token, action? })` — public (unauth): verifies token, resolves student + cohort, auto-decides `in`/`out` when `action` omitted, writes to `attendance` via the existing helpers, returns greeting payload (name, action taken, streak, cohort, plus new champion badges if applicable).

**Admin UI**

- New "Student QR" column/action in `RosterTab`: preview modal with `QRCodeCanvas` (student ID centered, cohort color border), Download PNG, Copy link.
- Bulk "Download all QRs (PDF)" button — one page per student, printable ID-card style, uses `jspdf` + `qrcode` (`bun add jspdf qrcode @types/qrcode`).   
  
Student UI  
Let the student be able to download his/her QR code himself/herself after successfully scanned and ready/during the clock in/clock out. It should appear on the student clock in/clock out dashboard

**Kiosk (`src/routes/kiosk.tsx`)**

- Auto-detect scanned payload: if it parses as `stu.*` (or URL `?s=`), skip verify-daily-QR + ID-entry stages and go straight to `kioskClockWithStudentToken` → greeting. Daily QR flow stays as a fallback.
- Query param `/kiosk?s=<token>` also auto-clocks (allows opening the student's QR link directly).

## 2. Champion / crown system

Two live titles calculated from `attendance`:

- **Attendance Champion** — highest attended-days count in the current cohort window (ties broken by highest streak).
- **Early Bird** — student with the most days this cohort where they were the *first* to clock in.  
The system should use the highest attended-days count together with the student with the most days this cohort where they were the *first* to clock in to crown the champion.

**Server fn (`src/lib/champions.functions.ts`)**

- `getCurrentChampions({ cohortId })` → `{ champion, earlyBird }` with name, avatar initials, count, cohort color.
- `getStudentTitles({ studentId })` → subset of `["champion","earlyBird","streak"]` the student currently holds — used to render a crown/flame overlay on the kiosk greeting and Live Ticker.

**UI touch-ups**

- Kiosk greeting: if returned titles include `champion`, render a gold `Crown` badge above the name with a subtle sparkle burst; `earlyBird` shows a sunrise chip; existing streak flame stays.
- `LiveTicker`: append a small crown icon next to the champion's row when they appear.
- Landing hero: a compact "This week's champions" strip (name + cohort color pill + title).

## 3. Weeklybook (weekly recap)

Same visual family as the yearbook but scoped to one week per cohort.

**Server fn** — extend `gamification.functions.ts`:

- `getCohortWeekbook({ cohortId, weekStart? })` — defaults to current week; returns KPIs for that week's meeting days (attendance %, hours, session count), top 5 by attendance %, the week's Champion + Early Bird + Streak Leader, plus any reviews left that week.

**Admin UI (`src/components/admin/WeeklybookTab.tsx`)**

- New "Weeklybook" tab in `AdminShell` + `admin.index.tsx`.
- Cohort selector + week picker (prev/this/next arrows).
- 1080×1350 shareable card (mirrors YearbookTab layout), Champion + Early Bird featured on top with `Crown` / `Sunrise` icons, exports via `html-to-image` and Web Share API — same pattern as existing yearbook.

## 4. End-of-cohort book (enhancement to existing YearbookTab)

Existing Yearbook stays; add a "Book mode" toggle that renders a multi-page shareable PDF (cover + weekly recaps for every week in the cohort + final leaderboard). Reuses `getCohortWeekbook` per week and `getCohortYearbook` for the cover. Exports via `jspdf` (already added above) so users can print/share the whole cohort's story.

## Technical notes

- No schema changes required — champions and books derive from existing `attendance`, `students`, `cohorts`, `session_reviews`.
- Student QR tokens are unauthenticated by design (they only allow clocking that specific student in/out — same trust model as a physical ID card); token validity is enforced by HMAC signature and today-must-be-a-meeting-day check reuses `isMeetingDay`.
- `kioskClockWithStudentToken` is public but rate-limitable per student_id (simple in-memory throttle on the worker — already acceptable for a tablet-at-the-door use case).

## Files

- **New**: `src/lib/student-qr.server.ts`, `src/lib/student-qr.functions.ts`, `src/lib/champions.functions.ts`, `src/components/admin/WeeklybookTab.tsx`, `src/components/admin/StudentQrModal.tsx`
- **Updated**: `src/routes/kiosk.tsx` (student-QR fast path + champion overlay), `src/components/admin/RosterTab.tsx` (per-student QR + bulk PDF), `src/components/admin/AdminShell.tsx` + `src/routes/admin.index.tsx` (Weeklybook tab), `src/components/admin/YearbookTab.tsx` (book/PDF export + champion styling), `src/components/LiveTicker.tsx` (crown chip), `src/routes/index.tsx` (champions strip), `src/lib/gamification.functions.ts` (`getCohortWeekbook`).
- **Deps added**: `jspdf`, `qrcode`, `@types/qrcode`.