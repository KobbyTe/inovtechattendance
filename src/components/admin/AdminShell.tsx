import { useState, type ReactNode } from "react";
import {
  BarChart2,
  Calendar,
  CalendarX,
  GraduationCap,
  Layers,
  LogOut,
  QrCode,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type AdminTab =
  | "dashboard"
  | "roster"
  | "cohorts"
  | "records"
  | "reviews"
  | "absences"
  | "qr"
  | "settings";

const TABS: { id: AdminTab; label: string; icon: typeof BarChart2 }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart2 },
  { id: "roster", label: "Roster", icon: Users },
  { id: "cohorts", label: "Cohorts", icon: Layers },
  { id: "records", label: "Records", icon: Calendar },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "absences", label: "Absences", icon: CalendarX },
  { id: "qr", label: "QR Code", icon: QrCode },
  { id: "settings", label: "Settings", icon: Settings },
];

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

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-card border-r border-border">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary leading-tight">Inovtech</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Admin Panel</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="m-2 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary leading-tight">Inovtech Admin</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {TABS.find((t) => t.id === tab)?.label}
              </p>
            </div>
          </div>
          <button onClick={signOut} className="text-muted-foreground p-2">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-5xl px-4 py-5">{children}</div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border grid grid-cols-8 z-50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[10px] font-medium",
                tab === t.id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}