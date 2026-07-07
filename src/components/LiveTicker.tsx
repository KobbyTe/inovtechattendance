import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, LogIn, LogOut, Radio, Sunrise } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getRecentClockIns } from "@/lib/live-feed.functions";
import { getCurrentChampions } from "@/lib/champions.functions";
import { formatTime } from "@/lib/attendance";

type Entry = {
  id: string;
  studentId: string;
  firstName: string;
  lastInitial: string;
  clockIn: string;
  clockOut: string | null;
  action: "in" | "out";
  cohort: { name: string; color: string } | null;
};

export function LiveTicker() {
  const fetchFn = useServerFn(getRecentClockIns);
  const champFn = useServerFn(getCurrentChampions);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(false);
  const [champs, setChamps] = useState<{
    champion: { studentId: string; name: string; cohort: { name: string; color: string } | null } | null;
    earlyBird: { studentId: string; name: string; cohort: { name: string; color: string } | null } | null;
  }>({ champion: null, earlyBird: null });

  useEffect(() => {
    let alive = true;
    let firstLoad = true;
    async function load() {
      try {
        const rows = (await fetchFn()) as Entry[];
        if (!alive) return;
        const key = (r: Entry) => `${r.id}-${r.action}-${r.clockOut ?? ""}`;
        const newSeen = new Set(rows.map(key));
        // Detect any new events
        const hasNew = rows.some((r) => !seen.has(key(r)));
        if (hasNew && !firstLoad) {
          setPulse(true);
          setTimeout(() => setPulse(false), 900);
        }
        setSeen(newSeen);
        setEntries(rows.slice(0, 6));
        firstLoad = false;
      } catch (e) {
        // silent
      }
    }
    load();
    const id = setInterval(load, 8000);
    champFn({ data: {} }).then((r) => setChamps(r)).catch(() => {});
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nameToFirst(name: string) {
    const parts = name.trim().split(/\s+/);
    const initial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : "";
    return `${parts[0]}${initial}`;
  }

  function studentTitle(id: string): "champion" | "earlyBird" | null {
    if (champs.champion?.studentId === id) return "champion";
    if (champs.earlyBird?.studentId === id) return "earlyBird";
    return null;
  }

  return (
    <section className="mt-6">
      {(champs.champion || champs.earlyBird) && (
        <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {champs.champion && (
            <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-yellow-200/90">Cohort Champion</p>
                <p className="text-sm font-bold text-white truncate">{nameToFirst(champs.champion.name)}</p>
              </div>
            </div>
          )}
          {champs.earlyBird && (
            <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-orange-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-orange-200/90">Early Bird</p>
                <p className="text-sm font-bold text-white truncate">{nameToFirst(champs.earlyBird.name)}</p>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="glass rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
        <motion.span
          animate={pulse ? { scale: [1, 1.4, 1] } : {}}
          transition={{ duration: 0.6 }}
          className="inline-flex h-2 w-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.9)]"
        />
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" /> Live feed
        </h2>
        <span className="ml-auto text-[10px] text-blue-100/70">
          Auto-refresh · 8s
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-center text-sm text-blue-100/80">
          Waiting for the first clock-in of the day…
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {entries.map((r) => (
              <motion.li
                key={`${r.id}-${r.action}`}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="glass rounded-xl p-3 flex items-center gap-3 relative overflow-hidden"
                style={
                  r.cohort
                    ? {
                        borderLeft: `3px solid ${r.cohort.color}`,
                      }
                    : undefined
                }
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                    r.action === "in"
                      ? "bg-green-400/25 text-green-100 border border-green-300/50"
                      : "bg-blue-400/25 text-blue-100 border border-blue-300/50"
                  }`}
                >
                  {r.action === "in" ? (
                    <LogIn className="h-4 w-4" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {r.firstName} {r.lastInitial}{" "}
                    {studentTitle(r.studentId) === "champion" && (
                      <Crown className="inline h-3.5 w-3.5 text-yellow-300 -mt-0.5" />
                    )}
                    {studentTitle(r.studentId) === "earlyBird" && (
                      <Sunrise className="inline h-3.5 w-3.5 text-orange-300 -mt-0.5" />
                    )}
                    <span className="text-blue-100/70 font-normal text-xs">
                      {r.action === "in" ? "clocked in" : "clocked out"}
                    </span>
                  </p>
                  {r.cohort && (
                    <p className="text-[10px] text-blue-100/70 truncate">
                      {r.cohort.name}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-white tabular-nums">
                    {formatTime(r.action === "in" ? r.clockIn : (r.clockOut ?? r.clockIn))}
                  </p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}