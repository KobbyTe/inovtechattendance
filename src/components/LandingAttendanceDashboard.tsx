import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Crown, Menu, QrCode, Radio, Sunrise } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentChampions } from "@/lib/champions.functions";
import { getLandingAttendance } from "@/lib/live-feed.functions";
import { formatTime, initials } from "@/lib/attendance";
import { TodayQrDialog } from "@/components/TodayQrDialog";
import logoInovtech from "@/assets/logo-inovtech.png";

type AttendanceRow = {
  id: string;
  studentId: string;
  studentName: string;
  cohortName: string;
  clockIn: string;
  clockOut: string | null;
};

type Champion = { studentId: string; name: string } | null;
type Filter = "all" | "in" | "out";

export function LandingAttendanceDashboard() {
  const fetchAttendance = useServerFn(getLandingAttendance);
  const fetchChampions = useServerFn(getCurrentChampions);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [champion, setChampion] = useState<Champion>(null);
  const [earlyBird, setEarlyBird] = useState<Champion>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date()));
    let active = true;
    async function refresh() {
      try {
        const [attendance, champions] = await Promise.all([
          fetchAttendance(),
          fetchChampions({ data: {} }),
        ]);
        if (!active) return;
        setRows(attendance as AttendanceRow[]);
        setChampion(champions.champion);
        setEarlyBird(champions.earlyBird);
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 8_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [fetchAttendance, fetchChampions]);

  const shownRows = useMemo(
    () => rows.filter((row) => filter === "all" || (filter === "out" ? row.clockOut : !row.clockOut)),
    [filter, rows],
  );
  const clockedOut = rows.filter((row) => row.clockOut).length;
  const stillIn = rows.length - clockedOut;
  return (
    <div className="landing-theme min-h-screen bg-landing text-landing-foreground">
      <header className="sticky top-0 z-50 border-b border-landing-line bg-landing/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 shrink-0 border border-landing-line text-landing-muted hover:bg-landing-panel hover:text-landing-foreground">
            <Link to="/admin" aria-label="Open admin area"><Menu className="h-5 w-5" /></Link>
          </Button>
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-landing-foreground p-1">
            <img src={logoInovtech} alt="Inovtech logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold sm:text-lg">Inovtech Future Skills Bootcamp</p>
            <p className="text-[11px] text-landing-muted sm:text-xs">Attendance System</p>
          </div>
          <TodayQrDialog />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 sm:py-9">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-landing-action">{today}</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-[40px] sm:leading-tight">Today&apos;s attendance</h1>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-landing-line bg-landing-panel px-3 py-2 text-[10px] text-landing-muted">
            <span className="h-2 w-2 rounded-full bg-landing-success shadow-[0_0_10px_var(--landing-success)]" />
            <Radio className="h-3.5 w-3.5" /><strong className="text-landing-foreground">LIVE</strong><span>Auto-refresh · 8s</span>
          </div>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Attendance summary">
          <Metric label="Clocked in" value={rows.length} />
          <Metric label="Clocked out" value={clockedOut} />
          <Highlight icon={Crown} label="Cohort champion" value={shortName(champion?.name)} accent="action" />
          <Highlight icon={Sunrise} label="Early bird" value={shortName(earlyBird?.name)} accent="info" />
        </section>

        <section className="mt-5 overflow-hidden rounded-[20px] border border-landing-line bg-landing-panel">
          <div className="flex flex-col gap-3 border-b border-landing-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h2 className="text-lg font-bold">Students today</h2>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filter students">
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
              <FilterButton active={filter === "in"} onClick={() => setFilter("in")}>Still in</FilterButton>
              <FilterButton active={filter === "out"} onClick={() => setFilter("out")}>Clocked out</FilterButton>
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(230px,2fr)_minmax(130px,1fr)_112px_112px_112px] border-b border-landing-line px-6 py-3 text-[10px] font-bold uppercase text-landing-muted md:grid">
            <span>Student</span><span>Cohort</span><span>Clock in</span><span>Clock out</span><span>Status</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-landing-muted">Loading today&apos;s attendance…</div>
          ) : shownRows.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-semibold">No matching attendance yet</p>
              <p className="mt-1 text-sm text-landing-muted">New clock-ins will appear automatically.</p>
            </div>
          ) : (
            <div>
              {shownRows.map((row) => (
                <div key={row.id} className="grid gap-3 border-b border-landing-line px-4 py-4 last:border-b-0 md:grid-cols-[minmax(230px,2fr)_minmax(130px,1fr)_112px_112px_112px] md:items-center md:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-landing-chip text-[10px] font-bold">{initials(row.studentName)}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{row.studentName}</p><p className="text-[10px] text-landing-muted md:hidden">{row.cohortName}</p></div>
                  </div>
                  <p className="hidden truncate text-sm text-landing-muted md:block">{row.cohortName}</p>
                  <Data label="Clock in" value={formatTime(row.clockIn)} />
                  <Data label="Clock out" value={row.clockOut ? formatTime(row.clockOut) : "—"} />
                  <span className={`w-fit rounded-full px-3 py-1 text-[11px] font-bold ${row.clockOut ? "bg-landing-chip text-landing-muted" : "bg-landing-success-soft text-landing-success"}`}>
                    {row.clockOut ? "Clocked out" : "Still in"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        <p className="mt-4 text-right text-xs text-landing-muted">{stillIn} student{stillIn === 1 ? "" : "s"} currently on site</p>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="min-h-24 rounded-2xl border border-landing-line bg-landing-panel px-5 py-4"><p className="text-[11px] font-bold uppercase text-landing-muted">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>;
}

function Highlight({ icon: Icon, label, value, accent }: { icon: typeof Crown; label: string; value: string; accent: "action" | "info" }) {
  return <div className="flex min-h-24 items-center gap-4 rounded-2xl border border-landing-line bg-landing-panel px-5 py-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${accent === "action" ? "bg-landing-action text-landing-action-foreground" : "bg-landing-info text-landing-action-foreground"}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[11px] font-bold uppercase text-landing-muted">{label}</p><p className="mt-1 truncate text-base font-bold uppercase">{value}</p></div></div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" variant="outline" size="sm" onClick={onClick} className={`rounded-full border-landing-line px-3 ${active ? "bg-landing-foreground text-landing hover:bg-landing-foreground/90" : "bg-transparent text-landing-muted hover:bg-landing-chip hover:text-landing-foreground"}`}>{children}</Button>;
}

function Data({ label, value }: { label: string; value: string }) {
  return <p className="text-sm"><span className="mr-2 text-[10px] uppercase text-landing-muted md:hidden">{label}</span>{value}</p>;
}

function shortName(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
}