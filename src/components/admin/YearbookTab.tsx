import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getCohortYearbook } from "@/lib/gamification.functions";
import type { Cohort } from "@/types";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Download, Flame, Loader2, Share2, Sparkles, Star, Trophy } from "lucide-react";
import { motion } from "framer-motion";

type Yearbook = Awaited<ReturnType<typeof getCohortYearbook>>;

export function YearbookTab() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [data, setData] = useState<Yearbook | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fetchFn = useServerFn(getCohortYearbook);

  useEffect(() => {
    supabase
      .from("cohorts")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setCohorts((data ?? []) as Cohort[]);
        if (data && data.length && !selected) setSelected(data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchFn({ data: { cohortId: selected } })
      .then((r) => setData(r))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load yearbook"))
      .finally(() => setLoading(false));
  }, [selected, fetchFn]);

  async function exportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const png = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0b1220",
      });
      const link = document.createElement("a");
      link.download = `${data?.cohort.name || "cohort"}-yearbook.png`;
      link.href = png;
      link.click();
      toast.success("Yearbook image downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export image");
    } finally {
      setExporting(false);
    }
  }

  async function share() {
    if (!cardRef.current || !data) return;
    try {
      const png = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(png)).blob();
      const file = new File([blob], `${data.cohort.name}-yearbook.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: `${data.cohort.name} Yearbook`,
          text: `${data.cohort.name}: ${data.overallPct}% attendance across ${data.totalMeetings} sessions.`,
        });
      } else {
        exportPng();
      }
    } catch (e) {
      console.error(e);
    }
  }

  const accent = useMemo(() => data?.cohort.color || "#6366F1", [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cohort Yearbook</h1>
          <p className="text-xs text-muted-foreground">
            Auto-generated end-of-cohort recap. Shareable PNG.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={exportPng}
            disabled={!data || exporting}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PNG
          </button>
          <button
            onClick={share}
            disabled={!data}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-accent text-foreground text-sm font-semibold disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="rounded-2xl border border-border p-16 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Building yearbook…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            ref={cardRef}
            className="mx-auto relative rounded-3xl overflow-hidden text-white"
            style={{
              width: 1080,
              minHeight: 1350,
              background: `radial-gradient(1200px 800px at 10% 0%, ${accent}55, transparent), radial-gradient(1000px 700px at 90% 100%, #A78BFA55, transparent), linear-gradient(180deg,#0b1220,#131a36)`,
            }}
          >
            {/* decorative rings */}
            <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full border border-white/10" />
            <div className="absolute -bottom-56 -left-40 h-[600px] w-[600px] rounded-full border border-white/10" />

            <div className="relative p-14 flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black"
                  style={{ background: accent, boxShadow: `0 0 40px ${accent}` }}
                >
                  <Sparkles className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                    Cohort Yearbook · {new Date().getFullYear()}
                  </p>
                  <h2 className="text-5xl font-black">{data.cohort.name}</h2>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Attendance", value: `${data.overallPct}%`, sub: `${data.totalMeetings} sessions` },
                  { label: "Students", value: data.studentCount, sub: "on roster" },
                  { label: "Hours logged", value: data.totalHours, sub: `${data.sessionCount} check-outs` },
                  { label: "Avg rating", value: data.avgRating || "—", sub: "session reviews" },
                ].map((k) => (
                  <motion.div
                    key={k.label}
                    className="rounded-2xl p-5 border border-white/10"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <p className="text-xs uppercase tracking-wider text-white/60">{k.label}</p>
                    <p className="text-4xl font-black mt-1 tabular-nums">{k.value}</p>
                    <p className="text-[11px] text-white/50 mt-1">{k.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Leaders */}
              <div className="grid grid-cols-2 gap-4">
                <div
                  className="rounded-2xl p-6 border border-yellow-300/30"
                  style={{ background: "linear-gradient(135deg,#facc1533,#f9731633)" }}
                >
                  <p className="text-xs uppercase tracking-wider text-yellow-200 flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5" /> Attendance Champion
                  </p>
                  <p className="text-3xl font-black mt-2">
                    {data.leader?.name ?? "—"}
                  </p>
                  <p className="text-sm text-white/70 mt-1">
                    {data.leader ? `${data.leader.pct}% · ${data.leader.attended} sessions` : ""}
                  </p>
                </div>
                <div
                  className="rounded-2xl p-6 border border-orange-300/30"
                  style={{ background: "linear-gradient(135deg,#fb923c33,#ef444433)" }}
                >
                  <p className="text-xs uppercase tracking-wider text-orange-200 flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5" /> Streak Leader
                  </p>
                  <p className="text-3xl font-black mt-2">
                    {data.streakLeader?.name ?? "—"}
                  </p>
                  <p className="text-sm text-white/70 mt-1">
                    {data.streakLeader ? `${data.streakLeader.streak}-day streak` : ""}
                  </p>
                </div>
              </div>

              {/* Top performers */}
              <div className="rounded-2xl p-6 border border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-xs uppercase tracking-wider text-white/60 mb-3">Top 5 attendance</p>
                <ul className="space-y-2">
                  {data.topPerformers.map((p, i) => (
                    <li key={p.studentId} className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-black bg-white/10">
                        {i + 1}
                      </span>
                      <span className="flex-1 font-semibold">{p.name}</span>
                      <span className="tabular-nums text-white/70 text-sm">
                        {p.attended} sessions
                      </span>
                      <span
                        className="tabular-nums font-black w-14 text-right"
                        style={{ color: accent }}
                      >
                        {p.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Top reviews */}
              {data.topReviews.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  <p className="text-xs uppercase tracking-wider text-white/60">Voices from the cohort</p>
                  {data.topReviews.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-5 border border-white/10"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <div className="flex items-center gap-1 text-yellow-300 mb-1">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="h-3.5 w-3.5 fill-current" />
                        ))}
                      </div>
                      <p className="text-base leading-snug">"{r.text}"</p>
                      <p className="text-xs text-white/60 mt-2">— {r.name}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between text-xs text-white/50 pt-4 border-t border-white/10">
                <span>Inovtech Future Skills Bootcamp</span>
                <span>Generated {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}