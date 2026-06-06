import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO, startOfWeek, subWeeks } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Quote, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Review = {
  id: string;
  student_id: string;
  student_name: string;
  cohort_id: string | null;
  date: string;
  class_rating: number;
  enjoyment: boolean | null;
  achievements: string | null;
  class_feedback: string | null;
  teacher_note: string | null;
  submitted_at: string;
};

type Cohort = { id: string; name: string; color: string };

const BRAND = ["#1D4ED8", "#60A5FA", "#DBEAFE", "#FBBF24", "#93C5FD"];

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          fill={i <= n ? "#FBBF24" : "none"}
          stroke="#FBBF24"
        />
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  delay,
}: {
  label: string;
  value: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="bg-card/80 backdrop-blur">
        <CardContent className="pt-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCohort, setFilterCohort] = useState<string>("");
  const [filterRating, setFilterRating] = useState<string>("");
  const [filterEnjoy, setFilterEnjoy] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [wallLimit, setWallLimit] = useState(20);

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase
          .from("session_reviews")
          .select("*")
          .order("submitted_at", { ascending: false }),
        supabase.from("cohorts").select("id, name, color"),
      ]);
      setReviews((r ?? []) as Review[]);
      setCohorts((c ?? []) as Cohort[]);
      setLoading(false);
    })();
  }, []);

  const cohortMap = useMemo(
    () => Object.fromEntries(cohorts.map((c) => [c.id, c])),
    [cohorts],
  );

  const filtered = useMemo(
    () =>
      reviews.filter((r) => {
        if (filterCohort && r.cohort_id !== filterCohort) return false;
        if (filterRating && r.class_rating !== Number(filterRating)) return false;
        if (filterEnjoy === "yes" && r.enjoyment !== true) return false;
        if (filterEnjoy === "no" && r.enjoyment !== false) return false;
        return true;
      }),
    [reviews, filterCohort, filterRating, filterEnjoy],
  );

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.class_rating, 0) / reviews.length
      : 0;
  const enjoyedCount = reviews.filter((r) => r.enjoyment === true).length;
  const enjoyRate =
    reviews.length > 0 ? Math.round((enjoyedCount / reviews.length) * 100) : 0;
  const weekAgo = subWeeks(new Date(), 1);
  const thisWeek = reviews.filter(
    (r) => new Date(r.submitted_at) >= weekAgo,
  ).length;

  // Weekly trend (last 8 weeks)
  const weeklyData = useMemo(() => {
    const weeks: { week: string; avg: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = startOfWeek(subWeeks(new Date(), i));
      const end = startOfWeek(subWeeks(new Date(), i - 1));
      const inWeek = reviews.filter((r) => {
        const d = new Date(r.submitted_at);
        return d >= start && d < end;
      });
      const a =
        inWeek.length > 0
          ? inWeek.reduce((s, r) => s + r.class_rating, 0) / inWeek.length
          : 0;
      weeks.push({ week: format(start, "MMM d"), avg: Number(a.toFixed(2)) });
    }
    return weeks;
  }, [reviews]);

  const cohortData = useMemo(() => {
    const counts: Record<string, number> = {};
    reviews.forEach((r) => {
      const key = r.cohort_id ? cohortMap[r.cohort_id]?.name ?? "—" : "Unassigned";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [reviews, cohortMap]);

  const enjoyData = [
    { name: "Loved it", value: enjoyedCount },
    {
      name: "Not really",
      value: reviews.filter((r) => r.enjoyment === false).length,
    },
  ];

  const teacherNotes = reviews.filter((r) => r.teacher_note?.trim());

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading reviews…</p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Student feedback after every session.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label="Avg Class Rating"
          value={
            <span className="flex items-center gap-1.5">
              {avg.toFixed(1)}{" "}
              <Star className="h-5 w-5" fill="#FBBF24" stroke="#FBBF24" />
            </span>
          }
          delay={0}
        />
        <Metric label="Total Reviews" value={reviews.length} delay={0.05} />
        <Metric label="Enjoyment Rate" value={`${enjoyRate}%`} delay={0.1} />
        <Metric label="Reviews This Week" value={thisWeek} delay={0.15} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 flex flex-wrap gap-2">
          <select
            value={filterCohort}
            onChange={(e) => setFilterCohort(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All cohorts</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
          <select
            value={filterEnjoy}
            onChange={(e) => setFilterEnjoy(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All enjoyment</option>
            <option value="yes">Loved it</option>
            <option value="no">Not really</option>
          </select>
        </CardContent>
      </Card>

      {/* Feed */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        )}
        {filtered.map((r) => {
          const cohort = r.cohort_id ? cohortMap[r.cohort_id] : null;
          const isOpen = !!expanded[r.id];
          return (
            <motion.div
              key={r.id}
              whileHover={{ y: -2 }}
              className="transition-shadow hover:shadow-md"
            >
              <Card>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold">{r.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(r.date), "PP")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cohort && (
                        <span
                          className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                          style={{
                            background: `${cohort.color}22`,
                            color: cohort.color,
                            border: `1px solid ${cohort.color}55`,
                          }}
                        >
                          {cohort.name}
                        </span>
                      )}
                      <Stars n={r.class_rating} />
                      {r.enjoyment !== null && (
                        <span
                          className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                            r.enjoyment
                              ? "bg-green-500/15 text-green-700 dark:text-green-300"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {r.enjoyment ? "Yes 😄" : "No 😕"}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.achievements && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Achievements
                      </p>
                      <p className="text-sm">
                        {isOpen || r.achievements.length <= 100
                          ? r.achievements
                          : r.achievements.slice(0, 100) + "…"}
                      </p>
                    </div>
                  )}

                  {r.class_feedback && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Class feedback
                      </p>
                      <p className="text-sm">
                        {isOpen || r.class_feedback.length <= 100
                          ? r.class_feedback
                          : r.class_feedback.slice(0, 100) + "…"}
                      </p>
                    </div>
                  )}

                  {r.teacher_note && (
                    <div className="rounded-lg border-l-4 border-blue-500 bg-blue-500/5 p-3 text-sm flex gap-2">
                      <Quote className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <span className="italic">{r.teacher_note}</span>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))
                    }
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    {isOpen ? "Hide full review" : "View full review"}
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Analytics */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <p className="font-semibold mb-3">Avg rating — last 8 weeks</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="week" fontSize={11} />
                  <YAxis domain={[0, 5]} fontSize={11} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#1D4ED8"
                    strokeWidth={2}
                    dot={{ fill: "#1D4ED8" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="font-semibold mb-3">Enjoyment split</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={enjoyData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={70}
                  >
                    {enjoyData.map((_, i) => (
                      <Cell key={i} fill={BRAND[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardContent className="pt-5">
            <p className="font-semibold mb-3">Reviews per cohort</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#60A5FA" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teacher Appreciation Wall */}
      <div>
        <h2 className="text-xl font-bold relative inline-block">
          Teacher Appreciation Wall ❤️
          <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400/0 via-blue-400 to-blue-400/0 blur-sm" />
        </h2>
        {teacherNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">
            No appreciations yet — they'll appear here after students submit
            their reviews.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teacherNotes.slice(0, wallLimit).map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4 bg-card/80 backdrop-blur border border-border border-l-4 border-l-blue-500"
                >
                  <Quote className="h-4 w-4 text-blue-500" />
                  <p className="text-sm italic mt-2">{r.teacher_note}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {r.student_name} · {format(parseISO(r.date), "PP")}
                    </span>
                    <Stars n={r.class_rating} size={12} />
                  </div>
                </motion.div>
              ))}
            </div>
            {teacherNotes.length > wallLimit && (
              <div className="mt-3 text-center">
                <Button
                  variant="outline"
                  onClick={() => setWallLimit((n) => n + 20)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}