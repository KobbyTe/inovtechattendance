/**
 * Passport-photo helpers (browser only).
 * Photos are cropped to a 3:4 passport ratio, downscaled and stored as a
 * compressed JPEG data URL so they render everywhere without signed URLs.
 */

export const PASSPORT_W = 300;
export const PASSPORT_H = 400;

export async function filesToPassportDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  const bitmap = await loadImage(file);

  // Center-crop to 3:4
  const targetRatio = PASSPORT_W / PASSPORT_H;
  const srcRatio = bitmap.width / bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (srcRatio > targetRatio) {
    sw = Math.round(bitmap.height * targetRatio);
    sx = Math.round((bitmap.width - sw) / 2);
  } else {
    sh = Math.round(bitmap.width / targetRatio);
    sy = Math.round((bitmap.height - sh) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = PASSPORT_W;
  canvas.height = PASSPORT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PASSPORT_W, PASSPORT_H);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, PASSPORT_W, PASSPORT_H);

  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  // Keep the row small — shrink quality until under ~120KB
  while (out.length > 160_000 && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}
