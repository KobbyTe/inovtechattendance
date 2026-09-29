import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { filesToPassportDataUrl } from "@/lib/student-photo";

export function PassportPhotoInput({
  value,
  onChange,
  label = "Passport photo",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await filesToPassportDataUrl(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use that image");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-[104px] w-[78px] rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
          {value ? (
            <img src={value} alt="Passport preview" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => ref.current?.click()}
            >
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {value ? "Replace photo" : "Upload photo"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onChange(null)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-[14rem]">
            Any photo works — it is cropped to passport size automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
