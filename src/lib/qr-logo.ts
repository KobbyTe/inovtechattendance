import logoInovtech from "@/assets/logo-inovtech.png";

/**
 * Compose a QR canvas with the Inovtech logo baked into the center.
 * Returns a NEW canvas so the source stays untouched.
 *
 * We use QR error-correction level "H" (30% recovery) on the source,
 * so covering ~18% of the modules with the logo is safe.
 */
export async function composeQrWithLogo(
  source: HTMLCanvasElement,
  opts: { scale?: number; logoRatio?: number; logoSrc?: string } = {},
): Promise<HTMLCanvasElement> {
  const scale = opts.scale ?? 2;
  const logoRatio = opts.logoRatio ?? 0.22;
  const logoSrc = opts.logoSrc ?? logoInovtech;

  const size = source.width * scale;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, size, size);

  const img = await loadImage(logoSrc);
  const logoSize = Math.round(size * logoRatio);
  const pad = Math.round(logoSize * 0.14);
  const boxSize = logoSize + pad * 2;
  const cx = (size - boxSize) / 2;
  const cy = (size - boxSize) / 2;

  // white rounded plate
  const radius = Math.round(boxSize * 0.18);
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, cx, cy, boxSize, boxSize, radius);
  ctx.fill();

  // subtle primary ring
  ctx.lineWidth = Math.max(1, Math.round(size * 0.004));
  ctx.strokeStyle = "rgba(29, 78, 216, 0.35)";
  roundRect(ctx, cx, cy, boxSize, boxSize, radius);
  ctx.stroke();

  // logo (contain)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, cx + pad, cy + pad, logoSize, logoSize);

  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Trigger a browser download of the composed QR as PNG.
 */
export async function downloadQrWithLogo(
  source: HTMLCanvasElement,
  filename: string,
) {
  const composed = await composeQrWithLogo(source);
  const link = document.createElement("a");
  link.download = filename;
  link.href = composed.toDataURL("image/png");
  link.click();
}

/**
 * Best-effort native share of the composed QR as a PNG file.
 * Returns true if the share sheet opened, false if unsupported.
 */
export async function shareQrWithLogo(
  source: HTMLCanvasElement,
  filename: string,
  title: string,
): Promise<boolean> {
  try {
    const composed = await composeQrWithLogo(source);
    const blob: Blob = await new Promise((res, rej) =>
      composed.toBlob((b) => (b ? res(b) : rej(new Error("blob failed"))), "image/png"),
    );
    const file = new File([blob], filename, { type: "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title, text: title });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}