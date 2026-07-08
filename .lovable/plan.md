## 1. Compulsory kiosk review (on clock-out)

Reviews only make sense after a session, so trigger the flow on **clock-out** (not clock-in). Clock-in stays a 1-second "Welcome back" celebration.

**Flow on the kiosk after a successful clock-out scan:**

```text
scan QR → "Goodbye, Kwabena 👋" hero (2s)
       → Review sheet slides up (cannot be dismissed)
       → 1-tap star rating (1–5, huge touch targets)
       → Quick-tag chips (pacing / content / instructor / clarity / energy) — multi-select
       → Optional 1-line note (voice-to-text button using Web Speech API)
       → "Submit & finish" → confetti → returns to idle scanner
       → Skip is NOT available; only "Submit" advances
```

**Why compulsory works here:** the student is already standing at the tablet, the door is right there, and they can't leave the kiosk view without tapping submit. If they walk away, a 60s watchdog auto-submits with just the star rating (so we never lose the clock-out record, and we never store a fake tag/note).

**Design language (matches the aurora/hero system already in the app):**
- Full-screen frosted-glass sheet over the aurora shader, spring-in from bottom (framer-motion `type: "spring", stiffness: 260, damping: 26`).
- Stars are 72px, fill-and-scale on tap with a soft haptic-style bounce, and the sheet's accent gradient shifts hue with the rating (red→amber→emerald).
- Tag chips use the cohort color as the "selected" ring; unselected chips have a subtle shimmer sweep every 4s to signal they're tappable.
- Submit button is disabled until a star is chosen, then pulses gently.
- After submit: `Sparkles` burst + "Thanks — sentiment logged ✨" toast, then auto-return to the scanner in 2s.

**Wiring:**
- New `KioskReviewSheet` component in `src/components/kiosk/KioskReviewSheet.tsx`.
- `kiosk.tsx` state machine gains a `"review"` phase entered only when `action === "out"`. The existing `kioskClockWithStudentToken` handler already knows the action, so we return `{ requiresReview: true, attendanceId }` on clock-outs and the client blocks idle-return until submitted.
- Submission reuses `submitSessionReview` from `src/lib/clock.functions.ts` (already fires the Gemini sentiment tagger). We add an `attendanceId` param so the kiosk path can post without a daily-QR token — server verifies the row was just written by the same kiosk endpoint (short-lived signed ticket returned alongside `requiresReview`).

## 2. Downloadable personal QR with the Inovtech logo

Two surfaces already exist (`MyQrCard` for the student's own dashboard, `StudentQrModal` for admins). Both currently render a plain QR. We upgrade both to the same premium card used by `QRCodePanel`.

**Visual (identical treatment across student + admin views):**
- Gradient border ring (cohort color → primary), `shadow-[0_20px_60px_-20px_rgba(29,78,216,0.55)]`, soft float animation.
- White QR canvas at 300px with `level="H"` (the H error-correction level tolerates the logo overlay without breaking scans).
- Center overlay: `logo-inovtech.png` inside a white 12px-padded rounded square with a 1px primary ring (same treatment as `QRCodePanel`). Absolutely positioned, `pointer-events-none`.
- Below the QR: student full name (bold), student ID in mono tracking-widest, cohort chip, tagline "Scan me at the kiosk".
- Reveal animation: card spring-scales in, QR modules do a subtle stagger fade (mask-based reveal from top-left → bottom-right).

**Downloading (this is where the logo matters — a DOM screenshot loses crispness):**
- Render QR to an offscreen `<canvas>` at 2× (600px).
- After render, draw the logo onto the same canvas via `ctx.drawImage` (white rounded rect → logo). This gives a single flat PNG with the logo baked in, at export resolution, not a screenshot.
- Provide two buttons:
  - **Download PNG** — `canvas.toDataURL("image/png")`, filename `inovtech-{studentId}.png`.
  - **Download card (PDF)** — uses `jspdf` (already installed) to place the composited PNG onto an A6 card with the student's name, cohort, and "Scan at the kiosk" caption. Nice for printing lanyard cards.
- Web Share API fallback on mobile: if `navigator.share` supports files, offer "Share to Photos / WhatsApp".

**Student self-service (no admin needed):**
- `MyQrCard` currently requires today's daily-QR token before minting. Keep that guard (prevents strangers minting tokens for arbitrary IDs), but after any successful clock-in the token is already in scope — the card auto-expands and pre-mints so the download is one tap away.
- Add a persistent "My QR" button in the app header (`AppHeader.tsx`) that opens a full-screen sheet with the same premium card, once the student has clocked in at least once (we cache the last valid token in `sessionStorage`, cleared on tab close).

**Admin bulk export (bonus, tiny scope):**
- `StudentQrModal` gets a "Download all in cohort" action in `RosterTab.tsx` that streams each student's composited PNG into a single multi-page PDF (one card per page, 4-up on A4). Reuses the same canvas compositor.

## Files touched

**New**
- `src/components/kiosk/KioskReviewSheet.tsx` — compulsory review UI.
- `src/lib/qr-compositor.ts` — pure function: `renderQrWithLogo({ url, size, fgColor, logoSrc }) → HTMLCanvasElement`. Used by MyQrCard, StudentQrModal, and the bulk PDF.
- `src/components/PremiumQrCard.tsx` — shared visual card (logo + gradient ring + animations) used by student + admin.

**Updated**
- `src/routes/kiosk.tsx` — add `"review"` phase for clock-outs, wire watchdog + confetti.
- `src/lib/student-qr.functions.ts` — `kioskClockWithStudentToken` returns `{ requiresReview, reviewTicket }` on `action === "out"`.
- `src/lib/clock.functions.ts` — `submitSessionReview` accepts an alternative `{ attendanceId, reviewTicket }` auth path used by the kiosk.
- `src/components/MyQrCard.tsx` — swap plain QR for `PremiumQrCard`; add PDF + share buttons.
- `src/components/admin/StudentQrModal.tsx` — same swap; add cohort bulk export.
- `src/components/admin/RosterTab.tsx` — "Export all QR cards (PDF)" button per cohort.
- `src/components/AppHeader.tsx` — "My QR" quick-access button after first clock-in.

No DB migration required — reviews already have a table, and the QR tokens are HMAC-signed (no new columns).
