import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: run the daily cohort lifecycle pass immediately. */
export const runCohortLifecycleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runCohortLifecycle } = await import("./cohort-lifecycle.server");
    return await runCohortLifecycle(supabaseAdmin as never);
  });

/** Admin-only advanced action: force a cohort's status, logged with a reason. */
export const forceCohortStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        cohortId: z.string().uuid(),
        status: z.enum(["upcoming", "active", "ended"]),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureYearbookGenerated } = await import("./cohort-lifecycle.server");

    const { data: cohort, error: cErr } = await supabaseAdmin
      .from("cohorts")
      .select("id, status")
      .eq("id", data.cohortId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cohort) throw new Error("Cohort not found");

    const now = new Date();
    const ending = data.status === "ended";
    const { error: uErr } = await supabaseAdmin
      .from("cohorts")
      .update({
        status: data.status,
        is_ended: ending,
        ended_at: ending ? now.toISOString() : null,
      })
      .eq("id", data.cohortId);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.from("cohort_status_overrides").insert({
      cohort_id: data.cohortId,
      from_status: cohort.status,
      to_status: data.status,
      reason: data.reason.trim(),
      admin_user_id: userId,
    });

    let yearbookGenerated = false;
    if (ending) yearbookGenerated = await ensureYearbookGenerated(supabaseAdmin as never, data.cohortId);

    return { ok: true as const, status: data.status, yearbookGenerated };
  });
