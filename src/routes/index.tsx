import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ClockInForm } from "@/components/ClockInForm";
import { TodayAttendance } from "@/components/TodayAttendance";
import { formatDateLong, getDayName, isMeetingDay } from "@/lib/attendance";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inovtech Future Skills Bootcamp — Attendance" },
      {
        name: "description",
        content:
          "Clock in and out for the Inovtech Future Skills Bootcamp. Sessions Wednesday, Thursday, and Friday.",
      },
      { property: "og:title", content: "Inovtech Future Skills Bootcamp — Attendance" },
      {
        property: "og:description",
        content: "Mark your attendance for the Inovtech Future Skills Bootcamp.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const meetingDay = isMeetingDay(now);
  const day = getDayName(now);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-xl px-4 py-5 space-y-5">
        <section className="rounded-xl bg-card border border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">{formatDateLong(now)}</p>
          <p className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tight text-foreground mt-1">
            {format(now, "h:mm:ss a")}
          </p>
          <div className="mt-3 inline-flex items-center gap-2">
            {meetingDay ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success px-3 py-1 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-success" />
                Meeting day · {day}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 text-warning-foreground px-3 py-1 text-xs font-semibold">
                No session today — attendance only on Wed, Thu, Fri
              </span>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-card border border-border p-4">
          <ClockInForm />
        </section>

        <TodayAttendance />
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">
        © 2025 Inovtech Future Skills Bootcamp
      </footer>
    </div>
  );
}
