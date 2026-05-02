import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const API_TIMEOUT_MS = 15000;

/**
 * POST /api/identify
 *
 * Accepts a multipart/form-data request with an "images" field containing the
 * plant photo. Forwards the image to the Plant.id v3 identification API and
 * returns the parsed results.
 *
 * Server-side only — no API keys are exposed to the client.
 */
export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const apiKey = process.env.PLANTID_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Plant.id API key is not configured on the server." },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const imageFile = formData.get("images");
  if (!imageFile || !(imageFile instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  // Forward the image to Plant.id
  const upstream = new FormData();
  upstream.append("images", imageFile, imageFile.name);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.plant.id/v3/identification", {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
      },
      body: upstream,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      return NextResponse.json(
        { error: `Plant.id API error (${response.status})` },
        { status: response.status },
      );
    }

    const json = await response.json();
    const suggestions = json.result?.classification?.suggestions ?? [];
    const results = suggestions.map((s: any) => ({
      name: s.name ?? "Unknown",
      confidence: Math.round((s.probability ?? 0) * 100),
      scientificName: s.details?.scientific_name ?? "",
      healthAssessment: s.details?.health_assessment ?? undefined,
    }));

    return NextResponse.json({ results });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json({ error: "Plant.id API request timed out" }, { status: 504 });
    }
    console.error("Plant.id API fetch error:", err);
    return NextResponse.json({ error: "Failed to contact Plant.id API" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
