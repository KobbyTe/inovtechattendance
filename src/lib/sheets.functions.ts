import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncToGoogleSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ spreadsheetId: z.string().min(10).max(120) }).parse)
  .handler(async ({ data, context }) => {
    const { performSheetsSync } = await import("./sheets.server");
    const { supabase } = context;
    const result = await performSheetsSync(supabase, data.spreadsheetId.trim());
    return { ok: true, ...result };
  });