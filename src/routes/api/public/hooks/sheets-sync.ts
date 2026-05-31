import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { performSheetsSync } from "@/lib/sheets.server";

export const Route = createFileRoute("/api/public/hooks/sheets-sync")({
  server: {
    handlers: {
      POST: async () => {
        const { data: settings, error } = await supabaseAdmin
          .from("app_settings")
          .select("google_sheet_id")
          .eq("singleton", true)
          .maybeSingle();
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        const spreadsheetId = settings?.google_sheet_id;
        if (!spreadsheetId) {
          return Response.json({ ok: true, skipped: true, reason: "no spreadsheet configured" });
        }
        try {
          const result = await performSheetsSync(supabaseAdmin, spreadsheetId);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});