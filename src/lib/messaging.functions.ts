import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only test send for guardian SMS / WhatsApp alerts. */
export const sendTestGuardianMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channel: z.enum(["sms", "whatsapp"]),
      phone: z.string().min(6).max(24),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: settings } = await context.supabase
      .from("app_settings")
      .select(
        "sms_sender_id,absence_sms_template,whatsapp_template_name,whatsapp_template_lang",
      )
      .eq("singleton", true)
      .maybeSingle();

    const { absenceSmsText, sendSms, sendWhatsApp, normalizePhone } = await import(
      "./messaging.server"
    );
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false as const, error: "Invalid phone number" };

    const now = new Date();
    const message = absenceSmsText({
      guardianName: "Test Guardian",
      studentName: "Test Student",
      dayName: now.toLocaleDateString("en-US", { weekday: "long" }),
      date: now.toISOString().slice(0, 10),
      template: settings?.absence_sms_template ?? null,
    });

    const result =
      data.channel === "sms"
        ? await sendSms({ to: phone, message, senderId: settings?.sms_sender_id ?? null })
        : await sendWhatsApp({
            to: phone,
            message,
            templateName: settings?.whatsapp_template_name ?? null,
            templateLang: settings?.whatsapp_template_lang ?? null,
            templateParams: [
              "Test Guardian",
              "Test Student",
              `${now.toLocaleDateString("en-US", { weekday: "long" })}, ${now
                .toISOString()
                .slice(0, 10)}`,
            ],
          });

    if ("skipped" in result) {
      return { ok: false as const, error: result.skipped, needsCredentials: true };
    }
    if (!result.ok) return { ok: false as const, error: result.error };
    return { ok: true as const, to: phone, message, id: result.id };
  });