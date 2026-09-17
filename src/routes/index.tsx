import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyAttendanceToken } from "@/lib/attendance-qr.functions";
import { Loader2, ShieldAlert } from "lucide-react";
import { ClockInForm } from "@/components/ClockInForm";
import logoInovtech from "@/assets/logo-inovtech.png";
import { MeshGradient } from "@paper-design/shaders-react";
import { LiveTicker } from "@/components/LiveTicker";

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

  return (
    <div className="relative min-h-screen flex flex-col bg-bootcamp-gradient overflow-hidden">
      {/* Aurora / mesh gradient WebGL background */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <MeshGradient
          className="h-full w-full"
          colors={["#0F2167", "#1E40AF", "#4338CA", "#60A5FA", "#A78BFA"]}
          speed={0.25}
          distortion={1}
          swirl={0.8}
        />
        <MeshGradient
          className="absolute inset-0 h-full w-full opacity-40 mix-blend-screen"
          colors={["#000000", "#818CF8", "#22D3EE", "#000000"]}
          speed={0.15}
          distortion={0.9}
          swirl={0.4}
        />
        {/* subtle grain / vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(8,15,50,0.55)_100%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-rail/70 px-4 py-3 backdrop-blur-xl">
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

        <LiveTicker />
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-blue-200/70">
        © 2025 Inovtech Future Skills Bootcamp
      </footer>
    </div>
  );
}
