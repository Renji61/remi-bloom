import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { resolveApiKey, apiKeysOverridable } from "@/lib/api-key-utils";

const API_TIMEOUT_MS = 10000;

/**
 * GET /api/weather/geocode?q=London
 *
 * Server-side proxy for OpenWeatherMap Geocoding API.
 * Resolves the API key server-side so the client doesn't need it.
 */
export async function GET(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const apiKey = await resolveApiKey(userId, "weatherApiKey", "WEATHER_API_KEY");
  if (!apiKey) {
    return NextResponse.json(
      {
        error: `OpenWeather API key is not configured.${apiKeysOverridable() ? " Provide it in Settings > API Keys or set WEATHER_API_KEY in the server environment." : " Set WEATHER_API_KEY in the server environment."}`,
      },
      { status: 500 },
    );
  }

  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Provide a query parameter 'q' with at least 2 characters" },
      { status: 400 },
    );
  }

  const upstreamUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(upstreamUrl, { signal: controller.signal });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Geocoding API error (${response.status})` },
        { status: response.status },
      );
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json({ error: "Geocoding API request timed out" }, { status: 504 });
    }
    console.error("Geocoding API fetch error:", err);
    return NextResponse.json({ error: "Failed to contact Geocoding API" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
