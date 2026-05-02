import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { resolveApiKey, apiKeysOverridable } from "@/lib/api-key-utils";

const API_TIMEOUT_MS = 15000;

/**
 * GET /api/weather/proxy?lat=...&lon=...&q=...
 *
 * Server-side proxy for OpenWeatherMap API calls.
 * Calls OpenWeather with the resolved API key (user setting → env var fallback)
 * so the client never needs to hold or send the key.
 *
 * Query parameters (either lat+lon or q):
 *   lat, lon  — coordinates
 *   q         — city name (e.g. "London" or "London,UK")
 *
 * API key resolution (in order):
 *   1. User setting "weatherApiKey" (if API_KEYS_OVERRIDABLE != "false")
 *   2. Environment variable WEATHER_API_KEY
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

  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  const q = request.nextUrl.searchParams.get("q");

  let upstreamUrl: string;
  if (lat && lon) {
    upstreamUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  } else if (q) {
    upstreamUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(q)}&appid=${apiKey}&units=metric`;
  } else {
    return NextResponse.json(
      { error: "Provide lat+lon or q query parameters" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(upstreamUrl, { signal: controller.signal });

    if (!response.ok) {
      return NextResponse.json(
        { error: `OpenWeather API error (${response.status})` },
        { status: response.status },
      );
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json({ error: "OpenWeather API request timed out" }, { status: 504 });
    }
    console.error("OpenWeather API fetch error:", err);
    return NextResponse.json({ error: "Failed to contact OpenWeather API" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
