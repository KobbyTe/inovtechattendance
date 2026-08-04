import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, type AdminTab } from "@/components/admin/AdminShell";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { RosterTab } from "@/components/admin/RosterTab";
import { RecordsTab } from "@/components/admin/RecordsTab";
import { QRCodePanel } from "@/components/admin/QRCodePanel";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { CohortsTab } from "@/components/admin/CohortsTab";
import { AbsencesTab } from "@/components/admin/AbsencesTab";
import { ReviewsTab } from "@/components/admin/ReviewsTab";
import { YearbookTab } from "@/components/admin/YearbookTab";
import { WeeklybookTab } from "@/components/admin/WeeklybookTab";
import { NewsletterTab } from "@/components/admin/NewsletterTab";

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
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/admin/login", replace: true });
        return;
      }
      // Bootstrap: first signed-in user becomes admin if none exists.
      // user_roles / claim_admin_if_none are added by a recent migration; types may lag.
      const sb = supabase as unknown as {
        rpc: (fn: string) => Promise<unknown>;
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              col: string,
              val: string,
            ) => Promise<{ data: Array<{ role: string }> | null }>;
          };
        };
      };
      await sb.rpc("claim_admin_if_none");
      const { data: roles } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      if (!isAdmin) {
        await supabase.auth.signOut();
        navigate({ to: "/admin/login", replace: true });
        return;
      }
      setReady(true);
    })();
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
      {tab === "cohorts" && <CohortsTab />}
      {tab === "records" && <RecordsTab />}
      {tab === "reviews" && <ReviewsTab />}
      {tab === "absences" && <AbsencesTab />}
      {tab === "weeklybook" && <WeeklybookTab />}
      {tab === "yearbook" && <YearbookTab />}
      {tab === "newsletter" && <NewsletterTab />}
      {tab === "qr" && <QRCodePanel />}
      {tab === "settings" && <SettingsTab />}
    </AdminShell>
  );
}