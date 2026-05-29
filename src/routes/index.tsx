import { createFileRoute } from "@tanstack/react-router";
import { ClockInForm } from "@/components/ClockInForm";
import { TodayAttendance } from "@/components/TodayAttendance";
import { GraduationCap } from "lucide-react";

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
          <div className="h-11 w-11 rounded-xl glass flex items-center justify-center shrink-0">
            <GraduationCap className="h-6 w-6 text-white" />
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

      <main className="relative z-10 flex-1 mx-auto w-full max-w-xl px-4 py-5 space-y-5">
        <section className="glass-strong rounded-2xl p-6 sm:p-7">
          <ClockInForm />
        </section>

        <TodayAttendance />
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-blue-200/70">
        © 2025 Inovtech Future Skills Bootcamp
      </footer>
    </div>
  );
}
