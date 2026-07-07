import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Crown, Flame, LogIn, LogOut, ScanLine, ShieldAlert, Sparkles, Sunrise } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { MeshGradient } from "@paper-design/shaders-react";
import { verifyAttendanceToken } from "@/lib/attendance-qr.functions";
import { lookupStudentForClockIn, clockAction } from "@/lib/clock.functions";
import { getStudentStreak } from "@/lib/live-feed.functions";
import { kioskClockWithStudentToken } from "@/lib/student-qr.functions";
import { getStudentTitles } from "@/lib/champions.functions";
import { format } from "date-fns";
import { initials } from "@/lib/attendance";

export const Route = createFileRoute("/kiosk")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kiosk Mode — Inovtech Attendance" },
      { name: "description", content: "Tablet kiosk mode with auto-scan QR check-in." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    s: typeof s.s === "string" ? s.s : undefined,
  }),
  component: KioskPage,
});

type Stage =
  | { kind: "scanning" }
  | { kind: "verifying" }
  | { kind: "invalid"; reason: string }
  | { kind: "id-entry"; token: string }
  | {
      kind: "greeting";
      firstName: string;
      fullName: string;
      action: "in" | "out";
      streak: number;
      cohort: { name: string; color: string } | null;
      titles: Array<"champion" | "earlyBird">;
    };

function KioskPage() {
  const search = Route.useSearch();
  const [stage, setStage] = useState<Stage>({ kind: "scanning" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const verify = useServerFn(verifyAttendanceToken);
  const lookup = useServerFn(lookupStudentForClockIn);
  const act = useServerFn(clockAction);
  const streakFn = useServerFn(getStudentStreak);
  const studentClockFn = useServerFn(kioskClockWithStudentToken);
  const titlesFn = useServerFn(getStudentTitles);
  const navigate = useNavigate();
  const [idInput, setIdInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-clock when arriving with ?s=<student-token>
  useEffect(() => {
    if (search.s) void handleStudentToken(search.s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.s]);

  // Camera + jsQR scanning
  useEffect(() => {
    if (stage.kind !== "scanning") return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

        const tick = () => {
          if (cancelled) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data) {
              handleScan(code.data);
              return;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setCameraError(
          e instanceof Error ? e.message : "Camera access denied. Enable camera permissions.",
        );
      }
    }
    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind]);

  async function handleStudentToken(token: string) {
    setStage({ kind: "verifying" });
    try {
      const r = await studentClockFn({ data: { token } });
      const [{ streak }, t] = await Promise.all([
        streakFn({ data: { studentId: r.student.student_id } }),
        titlesFn({ data: { studentId: r.student.student_id } }),
      ]);
      setStage({
        kind: "greeting",
        firstName: r.student.full_name.split(/\s+/)[0],
        fullName: r.student.full_name,
        action: r.action,
        streak,
        cohort: r.cohort ? { name: r.cohort.name, color: r.cohort.color } : null,
        titles: t.titles,
      });
      setTimeout(() => setStage({ kind: "scanning" }), 6500);
    } catch (e) {
      setStage({
        kind: "invalid",
        reason: e instanceof Error ? e.message : "Could not clock in",
      });
      setTimeout(() => setStage({ kind: "scanning" }), 2800);
    }
  }

  async function handleScan(raw: string) {
    setStage({ kind: "verifying" });
    try {
      // Extract token from a URL (?s= permanent student QR, or ?t= daily QR)
      let token = raw;
      let sToken: string | null = null;
      try {
        const u = new URL(raw);
        const s = u.searchParams.get("s");
        if (s) sToken = s;
        token = u.searchParams.get("t") ?? raw;
      } catch {
        /* not a URL */
      }
      // Detect a raw permanent student token
      if (!sToken && token.startsWith("stu.")) sToken = token;
      if (sToken) {
        await handleStudentToken(sToken);
        return;
      }
      const r = await verify({ data: { token } });
      if (!r.valid) {
        setStage({ kind: "invalid", reason: r.reason ?? "Invalid QR" });
        setTimeout(() => setStage({ kind: "scanning" }), 2500);
        return;
      }
      setStage({ kind: "id-entry", token });
    } catch (e) {
      setStage({
        kind: "invalid",
        reason: e instanceof Error ? e.message : "Verification failed",
      });
      setTimeout(() => setStage({ kind: "scanning" }), 2500);
    }
  }

  async function submitId(e: React.FormEvent) {
    e.preventDefault();
    if (stage.kind !== "id-entry") return;
    const id = idInput.trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const info = await lookup({ data: { token: stage.token, studentId: id } });
      const action: "in" | "out" = info.status === "active" ? "out" : "in";
      await act({
        data: { token: stage.token, studentId: info.student.student_id, action },
      });
      const [{ streak }, t] = await Promise.all([
        streakFn({ data: { studentId: info.student.student_id } }),
        titlesFn({ data: { studentId: info.student.student_id } }),
      ]);
      const first = info.student.full_name.split(/\s+/)[0];
      setStage({
        kind: "greeting",
        firstName: first,
        fullName: info.student.full_name,
        action,
        streak,
        cohort: info.cohort ? { name: info.cohort.name, color: info.cohort.color } : null,
        titles: t.titles,
      });
      setIdInput("");
      setTimeout(() => setStage({ kind: "scanning" }), 6500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clock in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#050b2c] text-white">
      {/* Aurora backdrop */}
      <div className="absolute inset-0" aria-hidden="true">
        <MeshGradient
          className="h-full w-full"
          colors={["#050b2c", "#1E40AF", "#4338CA", "#60A5FA", "#A78BFA"]}
          speed={0.3}
          distortion={1}
          swirl={0.9}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,11,44,0.75)_100%)]" />
      </div>

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-200/80">Kiosk mode</p>
            <p className="text-sm font-semibold">Inovtech Future Skills Bootcamp</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-blue-200/80">{format(now, "EEEE, MMM d")}</p>
          <p className="text-2xl font-mono font-bold tabular-nums">
            {format(now, "h:mm:ss a")}
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/" })}
          className="absolute top-2 right-2 opacity-30 hover:opacity-100 text-[10px] px-2 py-1 rounded"
        >
          Exit
        </button>
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-10">
        <AnimatePresence mode="wait">
          {stage.kind === "scanning" && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-2xl flex flex-col items-center gap-6"
            >
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
                Scan today's QR to begin
              </h1>
              <p className="text-blue-100/80 text-center max-w-md">
                Hold the QR poster steady in front of the camera. Detection is automatic.
              </p>
              <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden border-2 border-white/30 shadow-[0_25px_80px_-15px_rgba(96,165,250,0.6)]">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center">
                    <Camera className="h-10 w-10 text-red-300" />
                    <p className="font-semibold">Camera unavailable</p>
                    <p className="text-xs text-blue-100/80">{cameraError}</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {/* Scan viewfinder */}
                    <div className="absolute inset-6 border-2 border-white/70 rounded-2xl pointer-events-none" />
                    <motion.div
                      initial={{ y: "-100%" }}
                      animate={{ y: "100%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-x-6 h-[3px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_20px_rgba(103,232,249,0.9)]"
                    />
                    {/* Corners */}
                    {["top-6 left-6", "top-6 right-6", "bottom-6 left-6", "bottom-6 right-6"].map(
                      (pos) => (
                        <div
                          key={pos}
                          className={`absolute ${pos} h-8 w-8 border-cyan-300`}
                          style={{
                            borderTopWidth: pos.includes("top") ? 3 : 0,
                            borderBottomWidth: pos.includes("bottom") ? 3 : 0,
                            borderLeftWidth: pos.includes("left") ? 3 : 0,
                            borderRightWidth: pos.includes("right") ? 3 : 0,
                          }}
                        />
                      ),
                    )}
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </motion.div>
          )}

          {stage.kind === "verifying" && (
            <motion.div
              key="verifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <p className="text-2xl font-semibold">Verifying QR…</p>
            </motion.div>
          )}

          {stage.kind === "invalid" && (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <ShieldAlert className="h-16 w-16 text-red-300" />
              <h2 className="text-3xl font-bold">Invalid or expired QR</h2>
              <p className="text-blue-100/80 max-w-sm">{stage.reason}</p>
            </motion.div>
          )}

          {stage.kind === "id-entry" && (
            <motion.form
              key="id"
              onSubmit={submitId}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-lg glass-strong rounded-3xl p-8 space-y-6"
            >
              <div className="text-center space-y-1">
                <p className="text-xs uppercase tracking-widest text-green-300">QR verified</p>
                <h2 className="text-3xl font-bold">Enter your Student ID</h2>
              </div>
              <input
                autoFocus
                value={idInput}
                onChange={(e) => setIdInput(e.target.value.toUpperCase())}
                placeholder="STU-001"
                className="w-full h-20 rounded-2xl bg-white/95 text-foreground text-center text-3xl font-bold tracking-widest outline-none focus:ring-4 focus:ring-cyan-300/60"
              />
              {error && (
                <p className="text-center text-red-200 font-semibold">{error}</p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full h-16 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white text-xl font-bold shadow-lg shadow-blue-900/40 disabled:opacity-60"
              >
                {busy ? "Working…" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => setStage({ kind: "scanning" })}
                className="w-full text-sm text-blue-100/80 hover:text-white"
              >
                Cancel & scan again
              </button>
            </motion.form>
          )}

          {stage.kind === "greeting" && (
            <motion.div
              key="greet"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="w-full max-w-3xl relative"
            >
              {/* Confetti-esque sparkles */}
              <div className="absolute -inset-10 pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, x: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      x: (Math.random() - 0.5) * 400,
                      y: (Math.random() - 0.5) * 400,
                    }}
                    transition={{ duration: 1.6, delay: i * 0.03 }}
                    className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]"
                  />
                ))}
              </div>

              <div
                className="glass-strong rounded-[2rem] p-10 sm:p-14 relative overflow-hidden"
                style={{
                  borderTop: stage.cohort ? `4px solid ${stage.cohort.color}` : undefined,
                }}
              >
                <div className="flex items-center gap-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
                    className="h-24 w-24 sm:h-32 sm:w-32 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-bold shrink-0"
                    style={{
                      background:
                        "radial-gradient(circle at 30% 30%, #60A5FA, #2563EB)",
                      boxShadow:
                        "0 0 45px rgba(96,165,250,0.7), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    {initials(stage.fullName)}
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-sm uppercase tracking-widest text-blue-200/80 flex items-center gap-1.5">
                      {stage.action === "in" ? (
                        <>
                          <LogIn className="h-4 w-4" /> Welcome back
                        </>
                      ) : (
                        <>
                          <LogOut className="h-4 w-4" /> See you soon
                        </>
                      )}
                    </p>
                    <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
                      {stage.firstName} <span className="text-cyan-300">👋</span>
                    </h1>
                    {stage.cohort && (
                      <p
                        className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
                        style={{
                          background: `${stage.cohort.color}33`,
                          border: `1px solid ${stage.cohort.color}80`,
                        }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: stage.cohort.color }}
                        />
                        {stage.cohort.name}
                      </p>
                    )}
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 flex flex-wrap items-center gap-4"
                >
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-400/20 border border-orange-300/40 px-4 py-3">
                    <Flame className="h-6 w-6 text-orange-300" />
                    <div>
                      <p className="text-2xl font-bold leading-none">
                        {stage.streak}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-orange-200/90">
                        Day streak
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-green-400/20 border border-green-300/40 px-4 py-3">
                    <Sparkles className="h-6 w-6 text-green-300" />
                    <p className="text-sm font-semibold">
                      {stage.action === "in"
                        ? "You're checked in. Have a great session!"
                        : "Your session is logged. Safe travels!"}
                    </p>
                  </div>
                </motion.div>

                <p className="mt-8 text-xs text-blue-100/60 text-center">
                  Returning to scanner in a few seconds…
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}