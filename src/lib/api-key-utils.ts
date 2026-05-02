/**
 * Shared helpers for resolving API keys at runtime.
 *
 * Resolution priority:
 *   1. User-specific setting (stored in the settings table by the user in the UI)
 *   2. Server-wide environment variable (configured in .env / docker-compose)
 *
 * Set API_KEYS_OVERRIDABLE=false to prevent user settings from overriding env vars.
 */

import { getDb } from "@/db";
import { settings } from "@/db/schema/settings";
import { eq } from "drizzle-orm";

/**
 * Returns true if the user is allowed to override server-side env vars
 * with their own per-account API keys.
 */
export function apiKeysOverridable(): boolean {
  return process.env.API_KEYS_OVERRIDABLE !== "false";
}

/**
 * Resolve an API key for a given user:
 *   1. If API_KEYS_OVERRIDABLE != "false", check the user's stored setting first.
 *   2. Fall back to the provided env var name.
 *
 * Returns the resolved key, or undefined if neither source has a value.
 */
export async function resolveApiKey(
  userId: string,
  settingKey: string,
  envVarName: string,
): Promise<string | undefined> {
  // Check user setting first if overrides are allowed
  if (apiKeysOverridable()) {
    const userKey = await getUserSettingFromDb(userId, settingKey);
    if (userKey) return userKey;
  }

  // Fall back to environment variable
  return process.env[envVarName] || undefined;
}

/**
 * Read a single user setting directly from PostgreSQL (bypasses the
 * client-side IndexedDB layer, safe for server-side API routes).
 */
export async function getUserSettingFromDb(
  userId: string,
  key: string,
): Promise<string | undefined> {
  try {
    const db = getDb();
    const row = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, `${userId}:${key}`))
      .then((r) => r[0]);
    return row?.value || undefined;
  } catch {
    return undefined;
  }
}
