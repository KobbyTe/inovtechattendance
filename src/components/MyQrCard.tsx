import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useServerFn } from "@tanstack/react-start";
import { getMyStudentQrToken } from "@/lib/student-qr.functions";
import { Download, Loader2, QrCode } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Student-facing permanent QR card shown on the clock-in dashboard.
 * Lets a student download their own QR to scan at the kiosk next time.
 */
export function MyQrCard({ token, studentId }: { token: string; studentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mint = useServerFn(getMyStudentQrToken);

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

  function download() {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${studentId}-attendance-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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
          <div
            ref={ref}
            className="bg-white rounded-2xl p-4 shadow-lg ring-1 ring-black/5"
          >
            {loading || !url ? (
              <div className="h-56 w-56 flex items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <QRCodeCanvas
                value={url}
                size={224}
                fgColor="#1D4ED8"
                bgColor="#FFFFFF"
                level="H"
                includeMargin={false}
              />
            )}
          </div>
          <p className="font-mono text-xs text-blue-100/90 tracking-widest">
            {studentId}
          </p>
          <button
            type="button"
            onClick={download}
            disabled={!url}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white/95 text-slate-900 text-sm font-bold disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Download my QR
          </button>
        </motion.div>
      )}
    </div>
  );
}
