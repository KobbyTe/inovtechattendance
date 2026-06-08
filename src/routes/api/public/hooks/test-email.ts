import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendGmail, clockEventEmail } from "@/lib/gmail.server";

export const Route = createFileRoute("/api/public/hooks/test-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const to = url.searchParams.get("to") || "kwabenatekyi19@gmail.com";
        const action = (url.searchParams.get("action") as "in" | "out") || "in";

        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select(
            "email_header_image_url,email_signature,clockin_student_subject,clockin_student_body,clockin_guardian_subject,clockin_guardian_body,clockout_student_subject,clockout_student_body,clockout_guardian_subject,clockout_guardian_body",
          )
          .eq("singleton", true)
          .maybeSingle();

        const now = new Date();
        const msg = clockEventEmail({
          studentName: "Test Student",
          recipientName: "Test Student",
          action,
          dayName: format(now, "EEEE"),
          date: format(now, "yyyy-MM-dd"),
          time: format(now, "h:mm a"),
          audience: "student",
          subjectTemplate:
            action === "in"
              ? (settings?.clockin_student_subject ?? null)
              : (settings?.clockout_student_subject ?? null),
          bodyTemplate:
            action === "in"
              ? (settings?.clockin_student_body ?? null)
              : (settings?.clockout_student_body ?? null),
          headerImageUrl: settings?.email_header_image_url ?? null,
          signature: settings?.email_signature ?? null,
        });

        const result = await sendGmail({ to, ...msg });
        return Response.json({
          to,
          action,
          subject: msg.subject,
          headerImageUrl: settings?.email_header_image_url ?? null,
          textPreview: msg.text.slice(0, 200),
          htmlPreview: msg.html.slice(0, 400),
          result,
        });
      },
    },
  },
});