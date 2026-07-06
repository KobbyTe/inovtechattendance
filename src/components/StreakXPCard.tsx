import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Sparkles, Trophy, Zap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getStudentGamification } from "@/lib/gamification.functions";

type Stats = {
  streak: number;
  perfectWeeks: number;
  totalAttended: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
};

export function StreakXPCard({ studentId }: { studentId: string }) {
  const fetchFn = useServerFn(getStudentGamification);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFn({ data: { studentId } })
      .then((r) => alive && setStats(r as Stats))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [studentId, fetchFn]);

  if (loading || !stats) {
    return (
      <div className="glass rounded-2xl p-4 h-[92px] animate-pulse opacity-60" />
    );
  }

  const pct = Math.min(100, (stats.xpIntoLevel / stats.xpForNext) * 100);
  const streakActive = stats.streak > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-strong rounded-2xl p-4 relative overflow-hidden"
    >
      {/* animated backdrop shimmer */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px 100px at 20% 0%, rgba(251,146,60,0.35), transparent), radial-gradient(500px 120px at 90% 100%, rgba(96,165,250,0.35), transparent)",
        }}
      />
      <div className="relative flex items-center gap-3">
        <div className="relative shrink-0">
          <motion.div
            animate={
              streakActive
                ? { scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] }
                : {}
            }
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
              streakActive
                ? "bg-gradient-to-br from-orange-400 to-rose-500 shadow-[0_0_28px_rgba(251,113,133,0.55)]"
                : "bg-white/10 border border-white/20"
            }`}
          >
            <Flame
              className={`h-7 w-7 ${streakActive ? "text-white" : "text-white/50"}`}
              strokeWidth={2.5}
            />
          </motion.div>
          <div className="absolute -bottom-1 -right-1 rounded-full bg-white text-orange-600 text-[10px] font-black h-5 min-w-5 px-1 flex items-center justify-center shadow">
            {stats.streak}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-white">
            <p className="text-sm font-bold">
              {stats.streak > 0
                ? `${stats.streak}-day streak`
                : "Start your streak today!"}
            </p>
            {stats.perfectWeeks > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/25 border border-yellow-300/50 px-1.5 py-0.5 text-[9px] font-bold text-yellow-100">
                <Trophy className="h-2.5 w-2.5" /> {stats.perfectWeeks}× perfect
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-blue-100/80">
            <span className="inline-flex items-center gap-1 font-semibold text-white">
              <Zap className="h-3 w-3 text-yellow-300" /> LVL {stats.level}
            </span>
            <span className="tabular-nums">
              {stats.xpIntoLevel} / {stats.xpForNext} XP
            </span>
            <span className="ml-auto text-blue-100/70">
              {stats.totalAttended} days attended
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/15 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-rose-500 shadow-[0_0_10px_rgba(251,146,60,0.7)]"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {stats.streak >= 7 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white text-orange-600 px-2 py-0.5 text-[10px] font-black"
          >
            <Sparkles className="h-3 w-3" /> ON FIRE
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}