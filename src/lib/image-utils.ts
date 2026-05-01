/**
 * Compress and resize an image to reduce bandwidth before sending to Plant.id API.
 * Returns a Blob suitable for FormData upload.
 *
 * @param file - The original File from an input or canvas capture
 * @param maxWidth  - Maximum width in pixels (default 1024)
 * @param maxHeight - Maximum height in pixels (default 1024)
 * @param quality   - JPEG/WebP quality 0..1 (default 0.8)
 * @returns A compressed Blob
 */
export function compressImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(img.src);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Try webp first, fall back to jpeg
      const tryEncode = (mime: string) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else if (mime === "image/webp") {
              // WebP not supported, fall back to JPEG
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
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = URL.createObjectURL(file);
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
