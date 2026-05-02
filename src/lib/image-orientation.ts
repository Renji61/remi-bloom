/**
 * Minimal EXIF orientation detection and correction for client-side images.
 *
 * Reads the EXIF Orientation tag (0x0112) from JPEG files and returns a
 * "corrected" canvas that rotates/mirrors the image so it displays the same
 * way the camera captured it.
 */

const EXIF_HEADER = 0xffd8;
const APP1_MARKER = 0xffe1;
const TIFF_HEADER = 0x4949; // Little-endian "II"

/**
 * Read the EXIF Orientation value (1-8) from a JPEG ArrayBuffer.
 * Returns 1 (normal) if no EXIF data is found or parsing fails.
 */
function readExifOrientation(buffer: ArrayBuffer): number {
  const dv = new DataView(buffer);
  // JPEG starts with 0xFFD8
  if (dv.getUint16(0) !== EXIF_HEADER) return 1;

  let offset = 2;
  while (offset < buffer.byteLength - 2) {
    const marker = dv.getUint16(offset);
    const size = dv.getUint16(offset + 2);
    if (marker === APP1_MARKER) {
      // APP1 marker found — should contain EXIF
      const tiffStart = offset + 4;
      // Check for "Exif\0\0" header
      if (
        tiffStart + 6 <= buffer.byteLength &&
        dv.getUint32(tiffStart) === 0x45786966 && // "Exif"
        dv.getUint16(tiffStart + 4) === 0
      ) {
        const ifdStart = tiffStart + 6; // skip "Exif\0\0"
        return parseOrientationFromTiff(dv, ifdStart);
      }
      break;
    }
    offset += 2 + size;
    if (marker === 0xffda) break; // SOS — no more metadata
  }
  return 1;
}

function parseOrientationFromTiff(dv: DataView, start: number): number {
  const endian = dv.getUint16(start);
  const isLittle = endian === TIFF_HEADER;
  const getUint16 = (off: number) =>
    isLittle ? dv.getUint16(off, true) : dv.getUint16(off);
  const getUint32 = (off: number) =>
    isLittle ? dv.getUint32(off, true) : dv.getUint32(off);

  const ifdOffset = getUint32(start + 4);
  const entryCount = getUint16(start + ifdOffset);

  for (let i = 0; i < entryCount; i++) {
    const entryIdx = start + ifdOffset + 2 + i * 12;
    const tag = getUint16(entryIdx);
    if (tag === 0x0112) {
      // Orientation tag
      const format = getUint16(entryIdx + 2);
      const valueOffset = entryIdx + 8;
      // Orientation is typically a SHORT (format=3) stored directly in the value field
      return format === 3 ? getUint16(valueOffset) : dv.getUint16(valueOffset);
    }
  }
  return 1;
}

/**
 * Orientation values (1-8) and their corresponding canvas transformations:
 *   1 = normal
 *   2 = horizontal flip
 *   3 = 180° rotate
 *   4 = vertical flip
 *   5 = horizontal flip + 90° rotate (mirror + transpose)
 *   6 = 90° CW rotate
 *   7 = horizontal flip + 270° rotate
 *   8 = 270° CW rotate (90° CCW)
 */
function drawCorrectedOrientation(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  orientation: number,
) {
  const { width, height } =
    img instanceof HTMLVideoElement
      ? { width: img.videoWidth, height: img.videoHeight }
      : { width: img.naturalWidth, height: img.naturalHeight };

  // For orientations that swap width/height (5, 6, 7, 8), the canvas should
  // be swapped as well.
  const needsSwap = orientation >= 5 && orientation <= 8;
  const canvasWidth = needsSwap ? height : width;
  const canvasHeight = needsSwap ? width : height;

  // Only set canvas size if this function needs to (it's called before drawImage)
  // The caller should set canvas size separately. We just do the transform.

  ctx.save();

  switch (orientation) {
    case 2: // Horizontal flip
      ctx.translate(canvasWidth, 0);
      ctx.scale(-1, 1);
      break;
    case 3: // 180°
      ctx.translate(canvasWidth, canvasHeight);
      ctx.rotate(Math.PI);
      break;
    case 4: // Vertical flip
      ctx.translate(0, canvasHeight);
      ctx.scale(1, -1);
      break;
    case 5: // Horizontal flip + 90° rotate
      ctx.translate(canvasHeight, canvasWidth);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      break;
    case 6: // 90° CW
      ctx.translate(canvasHeight, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 7: // Horizontal flip + 270° rotate
      ctx.translate(0, canvasWidth);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(-1, 1);
      break;
    case 8: // 270° CW
      ctx.translate(0, canvasWidth);
      ctx.rotate(-Math.PI / 2);
      break;
    default:
      // 1 — normal, no transform
      break;
  }

  ctx.drawImage(img, 0, 0, width, height);
  ctx.restore();
}

/**
 * Get the corrected dimensions for a given orientation.
 * Returns { width, height } with width/height swapped if the orientation
 * requires it (5-8).
 */
export function getOrientedDimensions(
  width: number,
  height: number,
  orientation: number,
): { width: number; height: number } {
  return orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

/**
 * Draw an image (or video frame) onto a canvas, correcting for EXIF orientation.
 * Returns the canvas with the corrected image drawn on it.
 */
export function drawOrientedImage(
  img: HTMLImageElement | HTMLVideoElement,
  orientation: number,
  targetWidth?: number,
  targetHeight?: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const { width: srcW, height: srcH } =
    img instanceof HTMLVideoElement
      ? { width: img.videoWidth, height: img.videoHeight }
      : { width: img.naturalWidth, height: img.naturalHeight };

  const { width: orientedW, height: orientedH } = getOrientedDimensions(
    srcW,
    srcH,
    orientation,
  );

  const outW = targetWidth ?? orientedW;
  const outH = targetHeight ?? orientedH;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  if (orientation === 1) {
    // Normal orientation — simple draw
    ctx.drawImage(img, 0, 0, outW, outH);
  } else {
    // Need to apply EXIF transforms. For scaling, we draw at full resolution
    // first then scale the result, but drawCorrectedOrientation handles it.
    // Resize the canvas to oriented dimensions, apply transform, draw, then
    // the caller can read the result.
    canvas.width = orientedW;
    canvas.height = orientedH;

    ctx.save();
    switch (orientation) {
      case 2:
        ctx.translate(orientedW, 0);
        ctx.scale(-1, 1);
        break;
      case 3:
        ctx.translate(orientedW, orientedH);
        ctx.rotate(Math.PI);
        break;
      case 4:
        ctx.translate(0, orientedH);
        ctx.scale(1, -1);
        break;
      case 5:
        ctx.translate(orientedH, orientedW);
        ctx.rotate(Math.PI / 2);
        ctx.scale(-1, 1);
        break;
      case 6:
        ctx.translate(orientedH, 0);
        ctx.rotate(Math.PI / 2);
        break;
      case 7:
        ctx.translate(0, orientedW);
        ctx.rotate(-Math.PI / 2);
        ctx.scale(-1, 1);
        break;
      case 8:
        ctx.translate(0, orientedW);
        ctx.rotate(-Math.PI / 2);
        break;
    }
    ctx.drawImage(img, 0, 0, srcW, srcH);
    ctx.restore();

    // If a target size was specified, scale the result
    if (targetWidth && targetHeight && (targetWidth !== orientedW || targetHeight !== orientedH)) {
      const scaled = document.createElement("canvas");
      scaled.width = targetWidth;
      scaled.height = targetHeight;
      const sCtx = scaled.getContext("2d");
      if (sCtx) {
        sCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
        return { canvas: scaled, ctx: sCtx };
      }
    }
  }

  return { canvas, ctx };
}

/**
 * Load an image File, read its EXIF orientation, and return a canvas with
 * the image drawn in its correct orientation.
 */
export function loadAndOrientImage(file: File): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  orientation: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const orientation = readExifOrientation(buffer);

      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        try {
          const result = drawOrientedImage(img, orientation);
          resolve({ ...result, orientation });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(new Blob([buffer]));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
