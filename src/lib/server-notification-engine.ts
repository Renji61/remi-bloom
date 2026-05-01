/**
 * Server-side Notification Engine for REMI Bloom
 *
 * Moves external notification delivery (Gotify, Apprise) behind Next.js
 * API routes so the browser never calls external servers directly. This
 * avoids CORS, preflight, and private-network restrictions that would
 * otherwise prevent the browser from reaching Gotify/Apprise on the LAN.
 *
 * Known settings keys (persisted in IndexedDB via getSetting/setSetting):
 *  - notificationEngine: "gotify" | "apprise" | "disabled"
 *  - notificationUrl: string (Gotify server URL or Apprise API URL)
 *  - notificationToken: string (Gotify app token or Apprise API key)
 *  - useWeatherAlerts: "true" | "false"
 *  - useCareAlerts: "true" | "false"
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type NotificationEngine = "disabled" | "gotify" | "apprise";

export interface ServerNotificationConfig {
  engine: NotificationEngine;
  /** For Gotify: the base URL of the Gotify server (e.g. https://gotify.example.com)
   *  For Apprise: the URL of the Apprise API (e.g. http://apprise:8000) */
  url: string;
  /** For Gotify: the app token
   *  For Apprise: the API key (if configured, otherwise empty) */
  token: string;
}

export interface AlertPayload {
  title: string;
  body: string;
  /** Optional priority for Gotify (0-10) */
  priority?: number;
}

const NOTIFICATION_TIMEOUT_MS = 10000;

// ──────────────────────────────────────────────
// URL Normalisation Helpers
// ──────────────────────────────────────────────

/**
 * Normalise a Gotify server URL so it always ends with /message.
 */
export function normaliseGotifyUrl(base: string): string {
  const cleaned = base.replace(/\/+$/, "");
  if (cleaned.endsWith("/message")) return cleaned;
  return `${cleaned}/message`;
}

/**
 * Normalise an Apprise API URL so it always ends with /notify.
 */
export function normaliseAppriseUrl(base: string): string {
  const cleaned = base.replace(/\/+$/, "");
  if (cleaned.endsWith("/notify")) return cleaned;
  return `${cleaned}/notify`;
}

/**
 * Normalise the URL for the configured engine.
 */
export function normaliseUrl(engine: NotificationEngine, base: string): string {
  if (engine === "gotify") return normaliseGotifyUrl(base);
  if (engine === "apprise") return normaliseAppriseUrl(base);
  return base;
}

// ──────────────────────────────────────────────
// Engine implementations (server-side)
// ──────────────────────────────────────────────

/**
 * Send a notification via Gotify.
 */
async function sendGotify(
  config: ServerNotificationConfig,
  payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  const url = normaliseGotifyUrl(config.url);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gotify-Key": config.token,
      },
      body: JSON.stringify({
        title: payload.title,
        message: payload.body,
        priority: payload.priority ?? 5,
      }),
      signal: AbortSignal.timeout(NOTIFICATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      return {
        success: false,
        error: `Gotify error (${response.status}): ${text}`,
      };
    }

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error
        ? `Could not reach Gotify from the REMI Bloom server (${err.message})`
        : "Could not reach Gotify from the REMI Bloom server";
    return { success: false, error: message };
  }
}

/**
 * Send a notification via Apprise API.
 */
async function sendApprise(
  config: ServerNotificationConfig,
  payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = normaliseAppriseUrl(config.url);
  let apiUrl: string;
  try {
    const parsed = new URL(baseUrl);
    // Apprise API supports token-based auth via query parameter
    if (config.token) {
      parsed.searchParams.set("token", config.token);
    }
    // Use Authorization header instead of query parameter when possible
    apiUrl = parsed.toString();
  } catch {
    return { success: false, error: "Invalid Apprise URL" };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        type: "info",
        tag: "remi-bloom",
      }),
      signal: AbortSignal.timeout(NOTIFICATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      return {
        success: false,
        error: `Apprise error (${response.status}): ${text}`,
      };
    }

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error
        ? `Could not reach Apprise from the REMI Bloom server (${err.message})`
        : "Could not reach Apprise from the REMI Bloom server";
    return { success: false, error: message };
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Send a notification via the configured engine (server-side).
 */
export async function sendServerNotification(
  config: ServerNotificationConfig,
  payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  if (config.engine === "disabled" || !config.url) {
    return { success: false, error: "Notification engine is disabled or not configured" };
  }

  try {
    switch (config.engine) {
      case "gotify":
        return await sendGotify(config, payload);
      case "apprise":
        return await sendApprise(config, payload);
      default:
        return { success: false, error: `Unknown engine: ${config.engine}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending notification";
    return { success: false, error: message };
  }
}
