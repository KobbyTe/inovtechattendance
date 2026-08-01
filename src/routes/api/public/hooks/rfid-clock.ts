import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { format } from "date-fns";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const bodySchema = z.object({
  device_id: z.string().trim().min(1).max(64),
  rfid_uid: z.string().trim().min(2).max(64),
});

function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/rfid-clock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RFID_WEBHOOK_SECRET"];
        if (!secret) {
          return Response.json({ status: "misconfigured" }, { status: 500 });
        }

        const rawBody = await request.text();
        if (!verifySignature(rawBody, request.headers.get("x-signature"), secret)) {
          return Response.json({ status: "invalid_signature" }, { status: 401 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(JSON.parse(rawBody));
        } catch {
          return Response.json({ status: "bad_request" }, { status: 400 });
        }

        const uid = parsed.rfid_uid.toUpperCase();
        const { data: student, error: sErr } = await supabaseAdmin
          .from("students")
          .select("student_id, full_name")
          .ilike("rfid_uid", uid)
          .maybeSingle();
        if (sErr) return Response.json({ status: "error" }, { status: 500 });
        if (!student) return Response.json({ status: "unknown_card" }, { status: 404 });

        const now = new Date();
        const today = format(now, "yyyy-MM-dd");

        const { data: open } = await supabaseAdmin
          .from("attendance")
          .select("id")
          .eq("student_id", student.student_id)
          .is("clock_out", null)
          .order("clock_in", { ascending: false })
          .maybeSingle();

        if (open) {
          const { error } = await supabaseAdmin
            .from("attendance")
            .update({ clock_out: now.toISOString() })
            .eq("id", open.id);
          if (error) return Response.json({ status: "error" }, { status: 500 });
          return Response.json({
            status: "clocked_out",
            student_name: student.full_name,
            device_id: parsed.device_id,
          });
        }

        const { error } = await supabaseAdmin.from("attendance").insert({
          student_id: student.student_id,
          student_name: student.full_name,
          clock_in: now.toISOString(),
          date: today,
          day_name: format(now, "EEEE"),
          source: "rfid_kiosk",
        });
        if (error) return Response.json({ status: "error" }, { status: 500 });

        return Response.json({
          status: "granted",
          student_name: student.full_name,
          device_id: parsed.device_id,
        });
      },
    },
  },
});
