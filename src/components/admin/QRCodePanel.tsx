import { useRef, useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Download, RefreshCw, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getAttendanceQrToken } from "@/lib/attendance-qr.functions";
import { format } from "date-fns";
import { MEETING_DAYS, isMeetingDay } from "@/lib/attendance";
import logoInovtech from "@/assets/logo-inovtech.png";

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
    <div className="space-y-5 max-w-md mx-auto">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-accent/40 to-transparent p-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          A fresh QR is minted every day — including non-meeting days ({MEETING_DAYS.join(", ")}) so you can test anytime. Yesterday's code expires automatically.
        </p>
      </div>

      <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-primary via-secondary to-primary/40 shadow-[0_20px_60px_-20px_rgba(29,78,216,0.55)]">
        <div className="rounded-[calc(1.5rem-1.5px)] bg-card p-6 sm:p-7 flex flex-col items-center">
          {meta && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <Calendar className="h-3.5 w-3.5" />
              {meta.dayName}, {format(new Date(`${meta.date}T12:00:00`), "MMM d, yyyy")}
            </div>
          )}

          <div className="relative animate-float">
            {/* glow */}
            <div className="absolute -inset-4 rounded-3xl bg-primary/20 blur-2xl opacity-60" />
            <div
              ref={ref}
              className="relative bg-white p-4 rounded-2xl shadow-2xl ring-1 ring-primary/10"
            >
              {url ? (
                <div className="relative">
                  <QRCodeCanvas
                    value={url}
                    size={typeof window !== "undefined" && window.innerWidth >= 768 ? 300 : 248}
                    fgColor="#1D4ED8"
                    bgColor="#FFFFFF"
                    includeMargin={false}
                    level="H"
                  />
                  {/* Centered logo overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-1.5 shadow-md ring-1 ring-primary/10">
                      <img
                        src={logoInovtech}
                        alt="Inovtech"
                        className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 w-64 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  Generating today's QR…
                </div>
              )}
            </div>
          </div>

          <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Inovtech Future Skills Bootcamp
          </p>

          {url && (
            <a
              href={url}
              className="mt-2 text-xs text-primary/80 hover:text-primary hover:underline break-all text-center max-w-xs"
            >
              {url}
            </a>
          )}
        </div>
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
          <Copy className="mr-2 h-4 w-4" /> Copy
        </Button>
      </div>

      <a
        href="/kiosk"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-center text-xs font-semibold text-primary hover:underline"
      >
        Launch Kiosk Mode → (open on the door tablet)
      </a>
    </div>
  );
}