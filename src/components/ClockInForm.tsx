import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Student, AttendanceRecord, Cohort } from "@/types";
import {
  formatDateLong,
  getDayName,
  initials,
  isMeetingDay,
  todayDateStr,
} from "@/lib/attendance";

type Status = "none" | "active" | "complete";

export function ClockInForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [idInput, setIdInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [status, setStatus] = useState<Status>("none");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  const meetingDay = isMeetingDay(now);

  // Tick clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Autofocus step 1 input
  useEffect(() => {
    if (step === 1) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Countdown auto-reset
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      goBack();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  function goBack() {
    setStep(1);
    setIdInput("");
    setStudent(null);
    setCohort(null);
    setStatus("none");
    setError(null);
    setSuccess(false);
    setCountdown(null);
  }

  async function refreshStatus(s: Student) {
    const today = todayDateStr();
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", s.student_id)
      .eq("date", today)
      .order("clock_in", { ascending: false })
      .limit(1);
    const rec = (data?.[0] ?? null) as AttendanceRecord | null;
    if (!rec) setStatus("none");
    else if (rec.clock_out) setStatus("complete");
    else setStatus("active");
  }

  async function verifyId(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const id = idInput.trim();
    if (!id) {
      triggerError("Please enter your Student ID.");
      return;
    }
    setVerifying(true);
    try {
      const { data, error: qErr } = await supabase
        .from("students")
        .select("*")
        .ilike("student_id", id)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!data) {
        triggerError("Invalid Student ID. Please check your ID and try again.");
        return;
      }
      const s = data as Student;
      setStudent(s);
      if (s.cohort_id) {
        const { data: c } = await supabase
          .from("cohorts")
          .select("*")
          .eq("id", s.cohort_id)
          .maybeSingle();
        setCohort((c as Cohort | null) ?? null);
      } else {
        setCohort(null);
      }
      await refreshStatus(s);
      setStep(2);
    } catch (e) {
      console.error(e);
      triggerError("Could not verify ID. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  function triggerError(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  async function handleClockIn() {
    if (!student) return;
    if (!meetingDay) {
      toast.error("Attendance only on Wednesday, Thursday, and Friday");
      return;
    }
    setBusy(true);
    try {
      const today = todayDateStr();
      const { error: insErr } = await supabase.from("attendance").insert({
        student_id: student.student_id,
        student_name: student.full_name,
        date: today,
        day_name: getDayName(),
      });
      if (insErr) throw insErr;
      setSuccess(true);
      setStatus("active");
      toast.success(`Welcome, ${student.full_name.split(" ")[0]}!`);
      setTimeout(() => setSuccess(false), 600);
      setCountdown(3);
    } catch (e) {
      console.error(e);
      toast.error("Could not clock in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    if (!student) return;
    setBusy(true);
    try {
      const today = todayDateStr();
      const { data: openRec } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", student.student_id)
        .eq("date", today)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .maybeSingle();
      if (!openRec) {
        toast.error("No active clock-in found for today.");
        return;
      }
      const { error: upErr } = await supabase
        .from("attendance")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", openRec.id);
      if (upErr) throw upErr;
      setStatus("complete");
      setSuccess(true);
      toast.success(`Goodbye, ${student.full_name.split(" ")[0]}!`);
      setTimeout(() => setSuccess(false), 600);
      setCountdown(3);
    } catch (e) {
      console.error(e);
      toast.error("Could not clock out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Top progress bar */}
      {(verifying || busy) && <div className="top-progress-bar" />}

      {/* Success flash overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
            style={{ background: "radial-gradient(circle, rgba(34,197,94,0.35) 0%, transparent 70%)" }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <CheckCircle2 className="h-32 w-32 text-green-400 drop-shadow-2xl" strokeWidth={2.5} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <form onSubmit={verifyId} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full glass flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Enter your Student ID
                </h2>
                <p className="text-sm text-blue-100/80">
                  Type your ID to verify your identity
                </p>
              </div>

              <div className={shake ? "animate-shake" : ""}>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  value={idInput}
                  onChange={(e) => {
                    setIdInput(e.target.value.toUpperCase());
                    if (error) setError(null);
                  }}
                  placeholder="STU-001"
                  className={`w-full h-16 rounded-xl bg-white/95 text-foreground text-center text-2xl font-bold tracking-widest px-4 outline-none transition-all ${
                    error
                      ? "ring-2 ring-red-400 focus:ring-red-400"
                      : "focus:ring-2 focus:ring-blue-400 focus:shadow-[0_0_0_6px_rgba(96,165,250,0.25)]"
                  }`}
                />
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-200 text-center font-medium"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={verifying}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-base font-bold shadow-lg shadow-blue-900/40 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    Verify ID <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="space-y-5"
          >
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-sm text-blue-100/90 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Wrong person? Go back
            </button>

            {/* Identity card */}
            {student && (
              <div className="glass-strong rounded-2xl p-5 flex items-center gap-4">
                <div
                  className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, #60A5FA, #2563EB)",
                    boxShadow:
                      "0 0 30px rgba(96,165,250,0.6), inset 0 1px 0 rgba(255,255,255,0.4)",
                  }}
                >
                  {initials(student.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-blue-100/70">
                    Welcome
                  </p>
                  <p className="text-xl font-bold text-white truncate">
                    {student.full_name.split(" ")[0]} 👋
                  </p>
                  <p className="text-xs text-blue-100/80 truncate">
                    {student.student_id} · {student.year_level}
                  </p>
                  {cohort && (
                    <span
                      className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: `${cohort.color}33`,
                        color: "#fff",
                        border: `1px solid ${cohort.color}80`,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cohort.color }} />
                      {cohort.name}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Live clock & date */}
            <div className="text-center text-white">
              <p className="text-xs sm:text-sm text-blue-100/80">
                {formatDateLong(now)}
              </p>
              <p className="text-4xl sm:text-5xl font-mono font-bold tabular-nums tracking-tight mt-1">
                <span className="clock-pulse">{format(now, "h:mm:ss a")}</span>
              </p>
              <div className="mt-3 inline-flex items-center gap-2">
                {meetingDay ? (
                  <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-semibold text-white">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-beacon" />
                    Meeting day · {getDayName(now)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-xs font-semibold text-amber-100">
                    No session today — Wed, Thu, Fri only
                  </span>
                )}
              </div>
            </div>

            {/* Status pill */}
            {status === "active" && (
              <div className="rounded-xl bg-green-500/20 border border-green-300/40 px-4 py-2.5 text-sm font-semibold text-green-100 text-center">
                You are currently clocked in ✓
              </div>
            )}
            {status === "complete" && (
              <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-semibold text-blue-100 text-center">
                Session complete for today
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleClockIn}
                disabled={busy || !meetingDay || status !== "none"}
                className="group w-full h-14 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-base font-bold shadow-lg shadow-blue-900/40 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                )}
                Clock In
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleClockOut}
                disabled={busy || !meetingDay || status !== "active"}
                className="group w-full h-14 rounded-xl glass text-white text-base font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                )}
                Clock Out
              </motion.button>
            </div>

            {countdown !== null && countdown > 0 && (
              <p className="text-center text-xs text-blue-100/80">
                Returning to home in {countdown}…
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}