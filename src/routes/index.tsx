import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyAttendanceToken } from "@/lib/attendance-qr.functions";
import { Loader2, ShieldAlert } from "lucide-react";
import { ClockInForm } from "@/components/ClockInForm";
import logoInovtech from "@/assets/logo-inovtech.png";

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
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
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

  return (
    <div className="relative min-h-screen flex flex-col bg-bootcamp-gradient overflow-hidden">
      {/* Animated background blobs */}
      <div
        className="blob"
        style={{ width: 400, height: 400, top: -100, left: -120, background: "#60A5FA" }}
      />
      <div
        className="blob"
        style={{
          width: 500,
          height: 500,
          bottom: -150,
          right: -150,
          background: "#818CF8",
          animationDelay: "6s",
        }}
      />
      <div
        className="blob"
        style={{
          width: 320,
          height: 320,
          top: "40%",
          left: "55%",
          background: "#A78BFA",
          animationDelay: "12s",
        }}
      />

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-2">
        <div className="mx-auto max-w-xl flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden p-1">
            <img src={logoInovtech} alt="Inovtech logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-tight">
              Inovtech Future Skills Bootcamp
            </h1>
            <p className="text-xs sm:text-sm text-blue-200 leading-tight">
              Attendance System
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 mx-auto w-full max-w-xl px-4 py-5">
        <section className="glass-strong rounded-2xl p-6 sm:p-7">
          {state.kind === "loading" && (
            <div className="flex flex-col items-center text-white py-10 gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-blue-100/90">Verifying QR code…</p>
            </div>
          )}
          {state.kind === "blocked" && (
            <div className="flex flex-col items-center text-center text-white py-8 gap-4">
              <div className="h-14 w-14 rounded-full glass flex items-center justify-center">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold">QR code required</h2>
                <p className="text-sm text-blue-100/90 max-w-sm">{state.reason}</p>
              </div>
              <Link
                to="/admin"
                className="text-xs text-blue-200/80 hover:text-white underline"
              >
                Admin sign in
              </Link>
            </div>
          )}
          {state.kind === "ok" && t && <ClockInForm token={t} />}
        </section>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-blue-200/70">
        © 2025 Inovtech Future Skills Bootcamp
      </footer>
    </div>
  );
}
