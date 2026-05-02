import { loadAndOrientImage, getOrientedDimensions } from "./image-orientation";

/**
 * Compress and resize an image to reduce bandwidth before sending to Plant.id API.
 * Returns a Blob suitable for FormData upload.
 *
 * Automatically corrects EXIF orientation for JPEG images (e.g. landscape photos
 * taken on mobile devices).
 *
 * @param file - The original File from an input or canvas capture
 * @param maxWidth  - Maximum width in pixels (default 1024)
 * @param maxHeight - Maximum height in pixels (default 1024)
 * @param quality   - JPEG/WebP quality 0..1 (default 0.8)
 * @returns A compressed Blob
 */
export async function compressImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.8
): Promise<Blob> {
  // For camera-captured JPEGs (already canvas-born, no EXIF) we can use the
  // fast path.  For user-uploaded files we need to check EXIF orientation.
  // We always go through the orientation-aware path to be safe.
  const { canvas, orientation } = await loadAndOrientImage(file);

  // Now resize if needed using the oriented dimensions
  const { width: orientedW, height: orientedH } = getOrientedDimensions(
    canvas.width,
    canvas.height,
    orientation,
  );

  let finalW = canvas.width;
  let finalH = canvas.height;

  if (orientedW > maxWidth || orientedH > maxHeight) {
    const ratio = Math.min(maxWidth / orientedW, maxHeight / orientedH);
    finalW = Math.round(orientedW * ratio);
    finalH = Math.round(orientedH * ratio);
  }

  // If resizing is needed, create a new canvas at the target size
  if (finalW !== canvas.width || finalH !== canvas.height) {
    const resized = document.createElement("canvas");
    resized.width = finalW;
    resized.height = finalH;
    const rCtx = resized.getContext("2d");
    if (!rCtx) throw new Error("Could not get canvas context");
    rCtx.drawImage(canvas, 0, 0, finalW, finalH);
    return encodeCanvas(resized, quality);
  }

  return encodeCanvas(canvas, quality);
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Try webp first, fall back to jpeg
    const tryEncode = (mime: string) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else if (mime === "image/webp") {
            tryEncode("image/jpeg");
          } else {
            reject(new Error("Canvas toBlob returned null"));
          }
        },
        mime,
        mime === "image/jpeg" ? Math.min(quality, 0.92) : quality
      );
    };
    tryEncode("image/webp");
  });
}

/**
 * Read a compressed image as a data URL (for preview).
 */
export function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob as data URL"));
    reader.readAsDataURL(blob);
  });
}
