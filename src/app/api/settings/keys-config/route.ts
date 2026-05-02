import { NextResponse } from "next/server";
import { apiKeysOverridable } from "@/lib/api-key-utils";

/**
 * GET /api/settings/keys-config
 *
 * Exposes the API_KEYS_OVERRIDABLE setting to the client so the
 * Settings > API Keys UI can disable fields accordingly.
 */
export async function GET() {
  return NextResponse.json({ overridable: apiKeysOverridable() });
}
