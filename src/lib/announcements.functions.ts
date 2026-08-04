import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const audienceEnum = z.enum(["current_students", "alumni", "all", "custom"]);

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Admin-only: create or update a draft/scheduled announcement. */
export const saveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(3).max(160),
        bodyHtml: z.string().trim().min(1).max(20000),
        flyerImageUrl: z.string().trim().max(1000).nullable().optional(),
        programFormLink: z.string().trim().max(1000).nullable().optional(),
        cohortId: z.string().uuid().nullable().optional(),
        targetAudience: audienceEnum,
        cohortCodes: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
        scheduledAt: z.string().datetime().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { htmlToPlain, slugify } = await import("./announcements.server");

    const payload = {
      title: data.title,
      body_html: data.bodyHtml,
      body_plain: htmlToPlain(data.bodyHtml),
      flyer_image_url: data.flyerImageUrl?.trim() || null,
      program_form_link: data.programFormLink?.trim() || null,
      cohort_id: data.cohortId ?? null,
      target_audience: data.targetAudience,
      audience_filter:
        data.targetAudience === "custom" ? { cohort_codes: data.cohortCodes ?? [] } : null,
      scheduled_at: data.scheduledAt ?? null,
      status: data.scheduledAt ? "scheduled" : "draft",
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("announcements")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }

    const slug = `${slugify(data.title)}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: row, error } = await supabaseAdmin
      .from("announcements")
      .insert({ ...payload, slug, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: (row as { id: string }).id };
  });

/** Admin-only: preview the resolved audience without sending. */
export const previewAnnouncementAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        targetAudience: audienceEnum,
        cohortCodes: z.array(z.string()).max(50).optional(),
        channels: z.object({ email: z.boolean(), sms: z.boolean(), whatsapp: z.boolean() }),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveRecipients } = await import("./announcements.server");
    const res = await resolveRecipients(
      supabaseAdmin as never,
      {
        id: "00000000-0000-0000-0000-000000000000",
        target_audience: data.targetAudience,
        audience_filter: { cohort_codes: data.cohortCodes ?? [] },
      },
      data.channels,
    );
    const byChannel = res.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.channel] = (acc[r.channel] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total: res.rows.length,
      byChannel,
      skippedNoConsent: res.skippedNoConsent,
      totalStudents: res.totalStudents,
    };
  });

/** Admin-only: queue an announcement for sending and dispatch the first batch. */
export const sendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        channels: z.object({ email: z.boolean(), sms: z.boolean(), whatsapp: z.boolean() }),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveRecipients, dispatchAnnouncementBatch } = await import(
      "./announcements.server"
    );

    const { data: ann, error } = await supabaseAdmin
      .from("announcements")
      .select("id,target_audience,audience_filter,status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ann) throw new Error("Announcement not found");
    if ((ann as { status: string }).status === "sent") {
      return { ok: false as const, error: "Already sent" };
    }

    const { rows, skippedNoConsent } = await resolveRecipients(
      supabaseAdmin as never,
      ann as never,
      data.channels,
    );
    if (rows.length === 0) {
      return { ok: false as const, error: "No opted-in recipients for this audience" };
    }
    const { error: insErr } = await supabaseAdmin
      .from("announcement_recipients")
      .upsert(rows as never, { onConflict: "announcement_id,channel,contact_value" });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("announcements").update({ status: "sending" }).eq("id", data.id);
    const first = await dispatchAnnouncementBatch(supabaseAdmin as never, data.id, 25);
    return { ok: true as const, queued: rows.length, skippedNoConsent, ...first };
  });

/** Admin-only: keep draining an in-flight announcement's queue from the UI. */
export const dispatchAnnouncementNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dispatchAnnouncementBatch } = await import("./announcements.server");
    return await dispatchAnnouncementBatch(supabaseAdmin as never, data.id, 25);
  });

/** Admin-only: delete a draft/scheduled announcement. */
export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Public: read a sent announcement for its /programs/{slug} landing page. */
export const getPublicAnnouncement = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: row } = await client
      .from("announcements")
      .select("title,body_html,body_plain,flyer_image_url,program_form_link,created_at,slug")
      .eq("slug", data.slug)
      .eq("status", "sent")
      .maybeSingle();
    return (row as {
      title: string;
      body_html: string;
      body_plain: string;
      flyer_image_url: string | null;
      program_form_link: string | null;
      created_at: string;
      slug: string;
    } | null) ?? null;
  });

/** Public: one-click unsubscribe from program newsletters (HMAC-signed link). */
export const unsubscribeFromNewsletter = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({ sid: z.string().trim().min(1).max(60), token: z.string().trim().min(8).max(64) })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { verifyUnsubscribeToken } = await import("./announcements.server");
    if (!verifyUnsubscribeToken(data.sid, data.token)) {
      return { ok: false as const, error: "Invalid or expired unsubscribe link" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("students")
      .update({ marketing_opt_in: false })
      .eq("student_id", data.sid);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
