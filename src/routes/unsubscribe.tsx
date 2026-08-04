import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { unsubscribeFromNewsletter } from "@/lib/announcements.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MailX } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: z.object({ sid: z.string().optional(), t: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Unsubscribe — Inovtech STEM Center" },
      {
        name: "description",
        content: "Stop receiving Inovtech STEM Center program announcements and newsletters.",
      },
      { property: "og:title", content: "Unsubscribe — Inovtech STEM Center" },
      {
        property: "og:description",
        content: "Manage your Inovtech STEM Center newsletter preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { sid, t } = Route.useSearch();
  const run = useServerFn(unsubscribeFromNewsletter);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function confirm() {
    if (!sid || !t) {
      setState("error");
      setError("This unsubscribe link is incomplete.");
      return;
    }
    setState("busy");
    const res = await run({ data: { sid, token: t } });
    if (res.ok) setState("done");
    else {
      setState("error");
      setError(res.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300">
        {state === "done" ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary mb-4" />
            <h1 className="text-xl font-bold mb-2">You're unsubscribed</h1>
            <p className="text-sm text-muted-foreground">
              You will no longer receive Inovtech program announcements. Attendance and absence
              notices are unaffected.
            </p>
          </>
        ) : (
          <>
            <MailX className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Unsubscribe from program updates</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Confirm to stop receiving newsletters about upcoming programs and cohorts.
            </p>
            <Button onClick={confirm} disabled={state === "busy"} className="w-full h-11">
              {state === "busy" ? "Working…" : "Confirm unsubscribe"}
            </Button>
            {state === "error" && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
