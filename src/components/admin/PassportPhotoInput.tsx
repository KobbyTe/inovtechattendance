import { useRef, useState } from "react";
import { Camera, Check, Crop, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { filesToPassportDataUrl } from "@/lib/student-photo";

export function PassportPhotoInput({
  value,
  onChange,
  label = "Passport photo",
  premium = false,
  error,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
  premium?: boolean;
  error?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cropping, setCropping] = useState(false);

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

  if (premium) {
    return (
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-student-text">
          <Camera className="h-5 w-5 text-student-accent" />
          {label} <span className="text-student-danger">*</span>
        </Label>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => ref.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void pick(event.dataTransfer.files?.[0]);
            }}
            className={`flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center transition-colors ${
              dragging ? "border-student-accent bg-student-accent-soft" : "border-student-line bg-student-field"
            }`}
          >
            <span className="mb-2 grid h-11 w-11 place-items-center rounded-full border border-student-line bg-student-panel text-student-accent">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </span>
            <span className="text-xs font-medium text-student-text">Click to upload</span>
            <span className="text-[11px] text-student-muted">or drag &amp; drop</span>
          </button>
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-student-line bg-student-field">
            {value ? (
              <>
                <img src={value} alt="Student passport preview" className="h-full w-full object-cover" />
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-student-success text-student-text">
                  <Check className="h-3.5 w-3.5" />
                </span>
              </>
            ) : (
              <Camera className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-student-muted" />
            )}
          </div>
        </div>
        {value && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCropping((current) => !current)} className="border-student-line bg-student-field text-student-text hover:bg-student-accent-soft hover:text-student-text">
              <Crop /> {cropping ? "Done" : "Crop preview"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} className="border-student-line bg-student-field text-student-text hover:bg-student-accent-soft hover:text-student-text">
              <RotateCcw /> Replace
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove photo" onClick={() => onChange(null)} className="text-student-danger hover:bg-student-danger-soft hover:text-student-danger">
              <Trash2 />
            </Button>
          </div>
        )}
        {cropping && value && (
          <p className="rounded-lg border border-student-line bg-student-field px-3 py-2 text-xs text-student-muted">
            The uploaded image is center-cropped to the official 3:4 passport ratio. Replace it to choose a different framing.
          </p>
        )}
        {error ? <p className="text-xs text-student-danger">{error}</p> : null}
      </div>
    );
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
