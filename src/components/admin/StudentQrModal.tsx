import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getStudentQrToken } from "@/lib/student-qr.functions";
import type { Cohort, Student } from "@/types";

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

  function download() {
    const canvas = cardRef.current?.querySelector("canvas");
    if (!canvas || !student) return;
    const link = document.createElement("a");
    link.download = `${student.student_id}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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
              <p className="text-center font-bold text-lg mt-1 text-slate-900">
                {student.full_name}
              </p>
              <div className="flex justify-center my-3">
                {loading || !url ? (
                  <div className="h-64 w-64 flex items-center justify-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <QRCodeCanvas
                    value={url}
                    size={256}
                    fgColor={accent}
                    bgColor="#FFFFFF"
                    level="H"
                    includeMargin={false}
                  />
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
