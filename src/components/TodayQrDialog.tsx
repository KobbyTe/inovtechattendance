import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getTodayAttendanceQr } from "@/lib/attendance-qr.functions";

export function TodayQrDialog() {
  const fetchQr = useServerFn(getTodayAttendanceQr);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetchQr()
      .then((r) => setUrl(`${window.location.origin}/?t=${encodeURIComponent(r.token)}`))
      .catch(() => setError("Could not load today's QR code. Try again."));
  }, [open, fetchQr]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto h-10 rounded-full bg-landing-action px-4 font-bold text-landing-action-foreground hover:bg-landing-action/90 sm:px-6">
          <QrCode className="h-4 w-4" />
          <span className="hidden sm:inline">Show QR code</span>
          <span className="sm:hidden">QR code</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scan to clock in or out</DialogTitle>
          <DialogDescription>Scan with your phone camera, enter your student ID, then clock in or out.</DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center py-2">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : url ? (
            <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
              <QRCodeSVG value={url} size={240} level="M" />
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}
        </div>
        {url && (
          <Button asChild variant="outline">
            <a href={url}>Open clock-in on this device</a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
