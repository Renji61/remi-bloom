import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/tiff",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/upload
 *
 * Accepts a multipart/form-data request with a "file" field.
 * Validates file type and size, then writes the file to /public/uploads/
 * and returns the public URL path.
 *
 * TODO: Replace local file-system storage with a cloud storage provider
 * (e.g. Vercel Blob, AWS S3, Cloudflare R2) for production deployments.
 */
export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported image format "${file.type}". Allowed: JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF`,
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Image too large. Maximum size is 10MB." },
      { status: 400 },
    );
  }

  try {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] || "webp";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadsDir, fileName), buffer);

    return NextResponse.json({
      url: `/uploads/${fileName}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}
