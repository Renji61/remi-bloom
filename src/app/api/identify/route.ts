import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { resolveApiKey, apiKeysOverridable } from "@/lib/api-key-utils";

const API_TIMEOUT_MS = 15000;

/**
 * POST /api/identify
 *
 * Accepts a multipart/form-data request with an "images" field containing the
 * plant photo. Forwards the image to the Plant.id v3 identification API and
 * returns the parsed results.
 *
 * API key resolution (in order):
 *   1. User setting "plantidApiKey" (if API_KEYS_OVERRIDABLE != "false")
 *   2. Environment variable PLANTID_API_KEY
 */
export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const apiKey = await resolveApiKey(userId, "plantidApiKey", "PLANTID_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      {
        error: `Plant.id API key is not configured.${apiKeysOverridable() ? " Provide it in Settings > API Keys or set PLANTID_API_KEY in the server environment." : " Set PLANTID_API_KEY in the server environment."}`,
      },
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

  // Forward the image to Plant.id v3 with details requested.
  // The "details" param tells the API to include common_names, taxonomy, url, etc.
  // Without this, only the basic suggestion name (usually scientific/Latin) is returned.
  const upstream = new FormData();
  upstream.append("images", imageFile, imageFile.name);
  upstream.append("similar_images", "true");
  upstream.append("details", "common_names,taxonomy,url,description");

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
    const results = suggestions.map((s: any) => {
      // In v3, s.name is usually the scientific/Latin name.
      // Details (when requested via the "details" form field) are in s.details.
      const details = s.details ?? {};
      const scientificName = details.scientific_name
        ? details.scientific_name
        : (s.name ?? "").trim();
      const commonNames: string[] = details.common_names ?? [];
      const name = commonNames.length > 0
        ? commonNames[0]
        : (s.name ?? "Unknown").trim();
      return {
        name,
        confidence: Math.round((s.probability ?? 0) * 100),
        scientificName,
        healthAssessment: details.health_assessment ?? undefined,
      };
    });

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
