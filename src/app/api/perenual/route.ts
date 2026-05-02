import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const API_TIMEOUT_MS = 15000;

/**
 * GET /api/perenual?action=species&q=Monstera+deliciosa
 * GET /api/perenual?action=care-guide&species_id=123
 * GET /api/perenual?action=search&q=Monstera
 *
 * Forwards requests to the Perenual API using the server-side API key.
 * All endpoints require authentication.
 */
export async function GET(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const apiKey = process.env.PERENUAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Perenual API key is not configured on the server." },
      { status: 500 },
    );
  }

  const action = request.nextUrl.searchParams.get("action");
  if (!action) {
    return NextResponse.json({ error: "action query parameter is required" }, { status: 400 });
  }

  let upstreamUrl: string;

  switch (action) {
    case "species": {
      const q = request.nextUrl.searchParams.get("q");
      if (!q) {
        return NextResponse.json({ error: "q query parameter is required for species action" }, { status: 400 });
      }
      upstreamUrl = `https://perenual.com/api/species-list?key=${apiKey}&q=${encodeURIComponent(q)}`;
      break;
    }
    case "care-guide": {
      const speciesId = request.nextUrl.searchParams.get("species_id");
      if (!speciesId) {
        return NextResponse.json({ error: "species_id query parameter is required for care-guide action" }, { status: 400 });
      }
      upstreamUrl = `https://perenual.com/api/species-care-guide-list?key=${apiKey}&species_id=${speciesId}`;
      break;
    }
    case "search": {
      const q = request.nextUrl.searchParams.get("q");
      if (!q) {
        return NextResponse.json({ error: "q query parameter is required for search action" }, { status: 400 });
      }
      upstreamUrl = `https://perenual.com/api/species-list?key=${apiKey}&q=${encodeURIComponent(q)}`;
      break;
    }
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Supported: species, care-guide, search` },
        { status: 400 },
      );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(upstreamUrl, { signal: controller.signal });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      return NextResponse.json(
        { error: `Perenual API error (${response.status})` },
        { status: response.status },
      );
    }

    const json = await response.json();

    // For search action, transform the response into the format the client expects
    if (action === "search") {
      const data: any[] = json.data ?? [];
      const results = data.map((s: any) => ({
        name: s.common_name || s.scientific_name?.[0] || "Unknown",
        scientificName: s.scientific_name?.[0] || "",
        thumbnailUrl: s.default_image?.medium_url ?? undefined,
      }));
      return NextResponse.json({ results });
    }

    return NextResponse.json(json);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json({ error: "Perenual API request timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to contact Perenual API" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
