// Payment screenshot validation. The browser-supplied filename and MIME type
// are ignored; the file type is detected from its magic bytes.

export const SCREENSHOT_BUCKET = "payment-screenshots";
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export type ImageKind = { ext: "jpg" | "png" | "webp"; contentType: string };

export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) {
    return { ext: "png", contentType: "image/png" };
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export type ScreenshotCheck =
  | { ok: true; kind: ImageKind; bytes: Uint8Array }
  | { ok: false; error: string };

/** Validates an uploaded image by size and magic bytes. `noun` is used in error messages. */
export async function validateImage(file: File, noun = "Images"): Promise<ScreenshotCheck> {
  if (file.size === 0) return { ok: false, error: `${noun} can't be empty files.` };
  if (file.size > MAX_SCREENSHOT_BYTES) return { ok: false, error: `${noun} must be 5 MB or smaller.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageKind(bytes);
  if (!kind) return { ok: false, error: `${noun} must be JPG, PNG or WebP images.` };
  return { ok: true, kind, bytes };
}

export const validateScreenshot = (file: File) => validateImage(file, "Screenshots");

export function screenshotPath(agentId: string, paymentId: string, ext: ImageKind["ext"]): string {
  return `${agentId}/${paymentId}.${ext}`;
}
