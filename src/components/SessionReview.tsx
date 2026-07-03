import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Star } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { submitSessionReview } from "@/lib/clock.functions";

const RATING_LABELS: Record<number, string> = {
  1: "Needs a lot of work 😔",
  2: "Could be better 🤔",
  3: "It was okay 😊",
  4: "Great session! 🙌",
  5: "Absolutely amazing! 🔥",
};

export function SessionReview({
  token,
  studentId,
  studentName,
  attendanceId,
  onClose,
}: {
  token: string;
  studentId: string;
  studentName: string;
  attendanceId: string | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [enjoy, setEnjoy] = useState<boolean | null>(null);
  const [achievements, setAchievements] = useState("");
  const [feedback, setFeedback] = useState("");
  const [teacher, setTeacher] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const flashRef = useRef<number | null>(null);
  const [flashStar, setFlashStar] = useState(0);
  const submitFn = useServerFn(submitSessionReview);

  useEffect(() => {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.3 },
      colors: ["#1D4ED8", "#60A5FA", "#DBEAFE", "#FBBF24"],
      ticks: 90,
    });
    const t = setTimeout(() => confetti.reset?.(), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!done) return;
    if (countdown <= 0) {
      onClose();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [done, countdown, onClose]);

  function tapStar(n: number) {
    setRating(n);
    setFlashStar(n);
    if (flashRef.current) window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => setFlashStar(0), 180);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitFn({
        data: {
          token,
          studentId,
          attendanceId: attendanceId ?? undefined,
          classRating: rating,
          enjoyment: enjoy,
          achievements: achievements || null,
          classFeedback: feedback || null,
          teacherNote: teacher || null,
        },
      });
      confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.5 },
        colors: ["#1D4ED8", "#60A5FA", "#DBEAFE", "#FBBF24", "#ffffff"],
      });
      setTimeout(
        () =>
          confetti({
            particleCount: 80,
            spread: 120,
            origin: { y: 0.6, x: 0.3 },
            colors: ["#FBBF24", "#60A5FA"],
          }),
        400,
      );
      setDone(true);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = studentName.split(" ")[0];
  const canNext = (step === 1 && rating > 0) || (step === 2 && enjoy !== null) || step >= 3;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(7,15,40,0.7)", backdropFilter: "blur(12px)" }}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 text-white"
        style={{
          background:
            "linear-gradient(160deg, rgba(29,78,216,0.92) 0%, rgba(15,23,80,0.96) 100%)",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        {!done && (
          <div className="flex items-center justify-center gap-2 mb-6 mt-2">
            {[1, 2, 3, 4].map((n) => (
              <motion.div
                key={n}
                layout
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={
                  n === step
                    ? "h-2 w-8 rounded-full bg-blue-300"
                    : "h-2 w-2 rounded-full bg-white/30"
                }
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <motion.svg
                viewBox="0 0 80 80"
                className="mx-auto h-24 w-24 mb-4"
              >
                <motion.circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="#60A5FA"
                  strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6 }}
                />
                <motion.path
                  d="M24 42 L36 54 L58 30"
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                />
              </motion.svg>
              <h3 className="text-2xl font-bold">Thank you, {firstName}! 🎉</h3>
              <p className="text-sm text-blue-100/80 mt-1">
                Your review has been submitted. See you next session!
              </p>
              <div className="mt-4 flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="h-6 w-6"
                    fill={n <= rating ? "#FBBF24" : "none"}
                    stroke="#FBBF24"
                  />
                ))}
              </div>
              <p className="mt-6 text-xs text-blue-100/60">
                Returning in {countdown}…
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              {step === 1 && (
                <div className="text-center">
                  <h3 className="text-2xl font-bold">How was today's class?</h3>
                  <p className="text-sm text-blue-100/80 mt-1">
                    Your feedback helps us improve every session.
                  </p>
                  <div
                    className="flex justify-center gap-2 my-8"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = n <= (hoverRating || rating);
                      return (
                        <motion.button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHoverRating(n)}
                          onClick={() => tapStar(n)}
                          whileTap={{ scale: 1.3 }}
                          animate={
                            rating === n
                              ? { scale: [1.3, 1] }
                              : { scale: 1 }
                          }
                          transition={{ type: "spring", stiffness: 400, damping: 12 }}
                          className="relative cursor-pointer"
                        >
                          <Star
                            className="h-12 w-12 sm:h-14 sm:w-14 transition-colors"
                            fill={active ? "#FBBF24" : "none"}
                            stroke={active ? "#FBBF24" : "#BFDBFE"}
                            strokeWidth={1.5}
                          />
                          {flashStar === n && (
                            <span className="absolute inset-0 rounded-full bg-white/60 animate-ping" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                  <AnimatePresence mode="wait">
                    {rating > 0 && (
                      <motion.p
                        key={rating}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-lg font-semibold text-amber-200"
                      >
                        {RATING_LABELS[rating]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {step === 2 && (
                <div className="text-center">
                  <h3 className="text-2xl font-bold">Did you enjoy today's session?</h3>
                  <div className="grid grid-cols-2 gap-3 mt-8">
                    {[
                      { v: true, label: "Yes, I loved it! 😄", bg: "bg-blue-500" },
                      { v: false, label: "Not really 😕", bg: "bg-blue-900/60" },
                    ].map((opt) => {
                      const sel = enjoy === opt.v;
                      return (
                        <motion.button
                          key={String(opt.v)}
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          animate={{ scale: sel ? 1.04 : 1 }}
                          onClick={() => setEnjoy(opt.v)}
                          className={`rounded-2xl p-5 text-left font-bold transition-all border cursor-pointer ${
                            sel
                              ? `${opt.bg} text-white border-white/40 shadow-lg`
                              : "bg-white/10 text-blue-50 border-white/15 hover:bg-white/15"
                          }`}
                        >
                          {sel && <Check className="h-5 w-5 mb-2" />}
                          <span className="block text-sm sm:text-base">
                            {opt.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold text-center">
                    Tell us more
                  </h3>
                  <div>
                    <label className="text-sm font-semibold">
                      What did you achieve today?{" "}
                      <span className="text-blue-200/70 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={achievements}
                      onChange={(e) =>
                        setAchievements(e.target.value.slice(0, 300))
                      }
                      rows={3}
                      placeholder="e.g. I learned how to build a REST API, completed my first React component..."
                      className="mt-1 w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:shadow-[0_0_0_4px_rgba(96,165,250,0.25)]"
                    />
                    <p className="text-[10px] text-right text-blue-100/60 mt-1">
                      {achievements.length} / 300
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold">
                      How was the class overall?{" "}
                      <span className="text-blue-200/70 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value.slice(0, 300))}
                      rows={3}
                      placeholder="Share any thoughts on the pace, content, or structure of today's session..."
                      className="mt-1 w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:shadow-[0_0_0_4px_rgba(96,165,250,0.25)]"
                    />
                    <p className="text-[10px] text-right text-blue-100/60 mt-1">
                      {feedback.length} / 300
                    </p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold">Shoutout a teacher! 🌟</h3>
                    <p className="text-sm text-blue-100/80 mt-1">
                      Write a short note about a teacher whose class you really enjoyed today.
                    </p>
                  </div>
                  <textarea
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value.slice(0, 400))}
                    rows={4}
                    placeholder="e.g. Mr. Kofi explained the concept so clearly — I finally understood recursion! Thank you."
                    className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:shadow-[0_0_0_4px_rgba(96,165,250,0.25)]"
                  />
                  <p className="text-[10px] text-right text-blue-100/60">
                    {teacher.length} / 400
                  </p>
                  <p className="italic text-xs text-blue-200/80 text-center">
                    Your kind words make a difference. Teachers love hearing from you!
                  </p>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                    className="text-sm text-blue-100/80 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                ) : (
                  <span className="text-xs text-blue-100/60 italic">
                    Review required to finish
                  </span>
                )}

                {step < 4 ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={!canNext}
                    onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                    className="h-12 px-6 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </motion.button>
                ) : (
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="h-12 px-6 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Submit Review
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}