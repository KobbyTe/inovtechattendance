import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getStudentQrToken } from "@/lib/student-qr.functions";
import type { Cohort, Student } from "@/types";
import logoInovtech from "@/assets/logo-inovtech.png";
import { downloadQrWithLogo } from "@/lib/qr-logo";

export function StudentQrModal({
  student,
  cohort,
  open,
  onClose,
}: {
  student: Student | null;
  cohort: Cohort | null;
  open: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const mint = useServerFn(getStudentQrToken);

  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    setLoading(true);
    setUrl("");
    mint({ data: { studentId: student.student_id } })
      .then((r) => {
        if (cancelled) return;
        setUrl(`${window.location.origin}/kiosk?s=${encodeURIComponent(r.token)}`);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to mint QR");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, student, mint]);

  async function download() {
    const canvas = cardRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !student) return;
    try {
      await downloadQrWithLogo(canvas, `inovtech-${student.student_id}.png`);
    } catch {
      toast.error("Download failed");
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  const accent = cohort?.color ?? "#1D4ED8";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Permanent QR — {student?.full_name}</DialogTitle>
        </DialogHeader>
        {student && (
          <div className="space-y-4">
            <div
              ref={cardRef}
              className="relative rounded-2xl p-5 bg-white shadow-xl mx-auto"
              style={{ border: `3px solid ${accent}` }}
            >
              <p className="text-[10px] uppercase tracking-widest text-center" style={{ color: accent }}>
                {cohort?.name ?? "Inovtech"} · Attendance ID
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                {student.photo_url && (
                  <img
                    src={student.photo_url}
                    alt={student.full_name}
                    className="h-16 w-12 rounded-md object-cover"
                    style={{ border: `2px solid ${accent}` }}
                  />
                )}
                <p className="font-bold text-lg text-slate-900">{student.full_name}</p>
              </div>
              <div className="flex justify-center my-3">
                {loading || !url ? (
                  <div className="h-64 w-64 flex items-center justify-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="relative">
                    <QRCodeCanvas
                      value={url}
                      size={256}
                      fgColor={accent}
                      bgColor="#FFFFFF"
                      level="H"
                      includeMargin={false}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div
                        className="bg-white rounded-lg p-1.5 shadow ring-1"
                        style={{ borderColor: accent }}
                      >
                        <img
                          src={logoInovtech}
                          alt="Inovtech"
                          className="h-12 w-12 object-contain"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center font-mono text-sm text-slate-700 tracking-widest">
                {student.student_id}
              </p>
              <p className="text-center text-[10px] text-slate-500 mt-1 flex items-center justify-center gap-1">
                <ScanLine className="h-3 w-3" /> Scan at kiosk to clock in / out
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={download} disabled={!url}>
                <Download className="mr-1.5 h-4 w-4" /> PNG
              </Button>
              <Button variant="outline" onClick={copy} disabled={!url}>
                <Copy className="mr-1.5 h-4 w-4" /> Copy link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
