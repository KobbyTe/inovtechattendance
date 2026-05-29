import { useRef, useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

export function QRCodePanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/attendance`);
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
      <div className="rounded-xl bg-card border border-border p-6 flex flex-col items-center">
        <div ref={ref}>
          {url && (
            <QRCodeCanvas
              value={url}
              size={typeof window !== "undefined" && window.innerWidth >= 768 ? 320 : 256}
              fgColor="#1D4ED8"
              bgColor="#FFFFFF"
              includeMargin
              level="M"
            />
          )}
        </div>
        <a
          href={url}
          className="mt-4 text-sm text-primary hover:underline break-all text-center"
        >
          {url}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={download} className="h-11">
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
        <Button variant="outline" onClick={copy} className="h-11">
          <Copy className="mr-2 h-4 w-4" /> Copy link
        </Button>
      </div>

      <div className="rounded-lg bg-accent/60 border border-accent p-4 text-sm text-foreground">
        Share this QR code with students. When scanned, it opens the clock-in form
        directly on their phone.
      </div>
    </div>
  );
}