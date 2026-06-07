import { useRef, useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getAttendanceQrToken } from "@/lib/attendance-qr.functions";
import { format } from "date-fns";
import { MEETING_DAYS, isMeetingDay } from "@/lib/attendance";

export function QRCodePanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<{ date: string; dayName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const getToken = useServerFn(getAttendanceQrToken);

  async function generate() {
    setBusy(true);
    try {
      const res = await getToken({ data: {} });
      const origin = window.location.origin;
      setUrl(`${origin}/?t=${encodeURIComponent(res.token)}`);
      setMeta({ date: res.date, dayName: res.dayName });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate QR");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function download() {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "inovtech-attendance-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="rounded-lg bg-accent/60 border border-accent p-4 text-sm text-foreground">
        A new QR code is generated daily — including non-meeting days ({MEETING_DAYS.join(", ")}) so you can test the flow anytime.
        Yesterday's code stops working automatically.
      </div>

      <div className="rounded-2xl glass-strong p-6 flex flex-col items-center animate-float">
        <div ref={ref} className="bg-white p-3 rounded-xl shadow-xl">
          {url ? (
            <QRCodeCanvas
              value={url}
              size={typeof window !== "undefined" && window.innerWidth >= 768 ? 320 : 256}
              fgColor="#1D4ED8"
              bgColor="#FFFFFF"
              includeMargin
              level="M"
            />
          ) : (
            <div className="h-64 w-64 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
              Generating today's QR…
            </div>
          )}
        </div>
        {meta && (
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Valid for {meta.dayName}, {format(new Date(`${meta.date}T12:00:00`), "MMM d, yyyy")} only
          </p>
        )}
        {url && (
          <a
            href={url}
            className="mt-2 text-xs text-primary hover:underline break-all text-center"
          >
            {url}
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button onClick={generate} disabled={busy} className="h-11" variant="secondary">
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {url ? "Regenerate" : "Generate"}
        </Button>
        <Button onClick={download} disabled={!url} className="h-11">
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
        <Button variant="outline" onClick={copy} disabled={!url} className="h-11">
          <Copy className="mr-2 h-4 w-4" /> Copy link
        </Button>
      </div>
    </div>
  );
}