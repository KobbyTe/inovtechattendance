import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, type AdminTab } from "@/components/admin/AdminShell";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { RosterTab } from "@/components/admin/RosterTab";
import { RecordsTab } from "@/components/admin/RecordsTab";
import { QRCodePanel } from "@/components/admin/QRCodePanel";
import { SettingsTab } from "@/components/admin/SettingsTab";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin — Inovtech Attendance" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AdminTab>("dashboard");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/admin/login", replace: true });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/admin/login", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <AdminShell tab={tab} setTab={setTab}>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "roster" && <RosterTab />}
      {tab === "records" && <RecordsTab />}
      {tab === "qr" && <QRCodePanel />}
      {tab === "settings" && <SettingsTab />}
    </AdminShell>
  );
}