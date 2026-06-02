import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateQrToken, verifyQrToken } from "./attendance-qr.server";

export const getAttendanceQrToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const d = data.date ? new Date(`${data.date}T12:00:00`) : new Date();
    return generateQrToken(d);
  });

export const verifyAttendanceToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(1).max(512) }).parse(input))
  .handler(async ({ data }) => verifyQrToken(data.token));