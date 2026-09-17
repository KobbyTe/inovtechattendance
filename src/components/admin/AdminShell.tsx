import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart2,
  Calendar,
  CalendarX,
  CalendarCheck,
  Layers,
  LogOut,
  Megaphone,
  Moon,
  QrCode,
  Settings,
  Star,
  Sparkles,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import logoInovtech from "@/assets/logo-inovtech.png";

export type AdminTab =
  | "dashboard"
  | "roster"
  | "cohorts"
  | "records"
  | "reviews"
  | "absences"
  | "weeklybook"
  | "yearbook"
  | "newsletter"
  | "payments"
  | "qr"
  | "settings";

const TABS: { id: AdminTab; label: string; icon: typeof BarChart2 }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart2 },
  { id: "roster", label: "Roster", icon: Users },
  { id: "cohorts", label: "Cohorts", icon: Layers },
  { id: "records", label: "Records", icon: Calendar },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "absences", label: "Absences", icon: CalendarX },
  { id: "weeklybook", label: "Weeklybook", icon: CalendarCheck },
  { id: "yearbook", label: "Yearbook", icon: Sparkles },
  { id: "newsletter", label: "News", icon: Megaphone },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "qr", label: "QR Code", icon: QrCode },
  { id: "settings", label: "Settings", icon: Settings },
];

function useDarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("inovtech-admin-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("inovtech-admin-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  }

  return { dark, toggle };
}

export function AdminShell({
  tab,
  setTab,
  children,
}: {
  tab: AdminTab;
  setTab: (t: AdminTab) => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { dark, toggle } = useDarkMode();
  const active = TABS.find((t) => t.id === tab);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="admin-theme min-h-screen bg-rail text-foreground">
      <div className="flex min-h-screen">
        {/* Charcoal icon rail */}
        <aside className="hidden md:flex w-[76px] shrink-0 flex-col items-center gap-1 bg-rail py-5">
          <div className="mb-4 h-10 w-10 overflow-hidden rounded-xl bg-white p-1.5">
            <img
              src={logoInovtech}
              alt="Inovtech logo"
              className="h-full w-full object-contain"
            />
          </div>
          <nav className="flex flex-1 flex-col items-center gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.label}
                aria-label={t.label}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-2xl transition-colors",
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-rail-muted hover:bg-white/10 hover:text-rail-foreground",
                )}
              >
                <t.icon className="h-[18px] w-[18px]" />
              </button>
            ))}
          </nav>
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="grid h-11 w-11 place-items-center rounded-2xl text-rail-muted transition-colors hover:bg-white/10 hover:text-rail-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </aside>

        {/* Main rounded canvas */}
        <div className="flex min-w-0 flex-1 flex-col md:py-4 md:pr-4">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background md:rounded-[28px]">
            <header className="sticky top-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-md sm:flex sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-card p-1.5 admin-soft md:hidden">
                  <img
                    src={logoInovtech}
                    alt="Inovtech logo"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold leading-tight sm:text-xl">
                    {active?.label ?? "Dashboard"}{" "}
                    <span className="align-middle">👋</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Inovtech Future Skills Bootcamp · {today}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={toggle}
                  aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                  className="grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground admin-soft transition-colors hover:text-foreground"
                >
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  onClick={signOut}
                  className="flex h-10 items-center gap-2 rounded-full bg-rail px-3 text-xs font-semibold text-rail-foreground transition-opacity hover:opacity-90 sm:px-4 sm:text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </header>

            <main className="flex-1 overflow-auto px-4 pb-24 sm:px-6 md:pb-8">
              <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
          </div>
        </div>
      </div>

      {/* Mobile bottom rail */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-6 bg-rail px-1 pb-1 pt-1 md:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium transition-colors",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-rail-muted",
            )}
          >
            <t.icon className="h-[18px] w-[18px]" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
