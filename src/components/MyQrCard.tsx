import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useServerFn } from "@tanstack/react-start";
import { getMyStudentQrToken } from "@/lib/student-qr.functions";
import { Download, Loader2, QrCode, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import logoInovtech from "@/assets/logo-inovtech.png";
import { downloadQrWithLogo, shareQrWithLogo } from "@/lib/qr-logo";
import { toast } from "sonner";

/**
 * Student-facing permanent QR card shown on the clock-in dashboard.
 * Lets a student download their own QR to scan at the kiosk next time.
 */
export function MyQrCard({ token, studentId }: { token: string; studentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mint = useServerFn(getMyStudentQrToken);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function");
  }, []);

  useEffect(() => {
    if (!expanded || url) return;
    let alive = true;
    setLoading(true);
    mint({ data: { token, studentId } })
      .then((r) => {
        if (!alive) return;
        setUrl(`${window.location.origin}/kiosk?s=${encodeURIComponent(r.token)}`);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [expanded, url, token, studentId, mint]);

  async function download() {
    const canvas = ref.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    try {
      await downloadQrWithLogo(canvas, `inovtech-${studentId}.png`);
    } catch {
      toast.error("Could not download QR");
    }
  }

  async function share() {
    const canvas = ref.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ok = await shareQrWithLogo(canvas, `inovtech-${studentId}.png`, `My Inovtech attendance QR (${studentId})`);
    if (!ok) toast("Sharing not supported here — try Download");
  }

  return (
    <div className="glass rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
          <QrCode className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Your personal QR</p>
          <p className="text-[11px] text-blue-100/80">
            Download once. Scan at the kiosk to clock in/out anytime.
          </p>
        </div>
        <span className="text-xs font-semibold text-blue-100/90">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 flex flex-col items-center gap-3"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative rounded-3xl p-[2px] bg-gradient-to-br from-blue-400 via-blue-600 to-indigo-500 shadow-[0_20px_50px_-15px_rgba(59,130,246,0.6)]"
          >
            <div
              ref={ref}
              className="relative bg-white rounded-[calc(1.5rem-2px)] p-4"
            >
              {loading || !url ? (
                <div className="h-56 w-56 flex items-center justify-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="relative">
                  <QRCodeCanvas
                    value={url}
                    size={224}
                    fgColor="#1D4ED8"
                    bgColor="#FFFFFF"
                    level="H"
                    includeMargin={false}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-1 shadow ring-1 ring-blue-200">
                      <img
                        src={logoInovtech}
                        alt="Inovtech"
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          <p className="font-mono text-xs text-blue-100/90 tracking-widest">
            {studentId}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={download}
              disabled={!url}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white/95 text-slate-900 text-sm font-bold disabled:opacity-60 hover:bg-white transition"
            >
              <Download className="h-4 w-4" /> Download PNG
            </button>
            {canShare && (
              <button
                type="button"
                onClick={share}
                disabled={!url}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white/10 text-white border border-white/25 text-sm font-bold disabled:opacity-60 hover:bg-white/20 transition"
              >
                <Share2 className="h-4 w-4" /> Share
              </button>
            )}
          </div>
          <p className="text-[10px] text-blue-100/70 text-center max-w-[16rem]">
            Save this once. Scan it at the kiosk anytime to clock in or out.
          </p>
        </motion.div>
      )}
    </div>
  );
}
