import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { resolveApiKey, apiKeysOverridable } from "@/lib/api-key-utils";

/**
 * GET /api/settings/keys-status
 *
 * Returns whether each API key is configured (from either user settings
 * or environment variables). Used by the client to conditionally
 * enable/disable features.
 */
export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const [plantidKey, perenualKey, weatherKey] = await Promise.all([
    resolveApiKey(userId, "plantidApiKey", "PLANTID_API_KEY"),
    resolveApiKey(userId, "perenualApiKey", "PERENUAL_API_KEY"),
    resolveApiKey(userId, "weatherApiKey", "WEATHER_API_KEY"),
  ]);

  return NextResponse.json({
    plantidConfigured: !!plantidKey,
    perenualConfigured: !!perenualKey,
    weatherConfigured: !!weatherKey,
    overridable: apiKeysOverridable(),
  });
}
