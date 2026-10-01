import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyAttendanceToken } from "@/lib/attendance-qr.functions";
import { Loader2, ShieldAlert } from "lucide-react";
import { ClockInForm } from "@/components/ClockInForm";
import { LandingAttendanceDashboard } from "@/components/LandingAttendanceDashboard";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { t?: string } =>
    typeof search.t === "string" ? { t: search.t } : {},
  component: Index,
});

function Index() {
  const { t } = Route.useSearch();
  const verify = useServerFn(verifyAttendanceToken);
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "ok" } | { kind: "blocked"; reason: string }
  >(t ? { kind: "loading" } : { kind: "blocked", reason: "Scan today's QR code to clock in." });

  useEffect(() => {
    if (!t) return;
    let cancelled = false;
    verify({ data: { token: t } })
      .then((r) => {
        if (cancelled) return;
        setState(r.valid ? { kind: "ok" } : { kind: "blocked", reason: r.reason || "Invalid code" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "blocked", reason: "Could not verify code. Try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [t, verify]);

  if (!t) return <LandingAttendanceDashboard />;

  return (
    <div className="landing-theme min-h-screen bg-landing px-4 py-10 text-landing-foreground">
      <main className="mx-auto w-full max-w-xl">
        <section className="rounded-2xl border border-landing-line bg-landing-panel p-6 sm:p-7">
          {state.kind === "loading" && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
               <p className="text-sm text-landing-muted">Verifying QR code…</p>
            </div>
          )}
          {state.kind === "blocked" && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-landing-chip">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold">QR code required</h2>
                <p className="max-w-sm text-sm text-landing-muted">{state.reason}</p>
              </div>
              <Link
                to="/admin"
                className="text-xs text-landing-info underline hover:text-landing-foreground"
              >
                Admin sign in
              </Link>
            </div>
          )}
          {state.kind === "ok" && t && <ClockInForm token={t} />}
        </section>

      </main>
    </div>
  );
}
