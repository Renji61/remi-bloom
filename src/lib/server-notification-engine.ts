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

// ──────────────────────────────────────────────
// URL Normalisation Helpers
// ──────────────────────────────────────────────

/**
 * Normalise a Gotify server URL so it always ends with /message.
 *
 * Rules:
 *  - Strip trailing slash.
 *  - If the path already ends with /message, leave it as-is.
 *  - Otherwise, append /message.
 *
 * Examples:
 *  http://host:8055       → http://host:8055/message
 *  http://host:8055/      → http://host:8055/message
 *  http://host:8055/message → http://host:8055/message
 */
export function normaliseGotifyUrl(base: string): string {
  const cleaned = base.replace(/\/+$/, "");
  if (cleaned.endsWith("/message")) return cleaned;
  return `${cleaned}/message`;
}

/**
 * Normalise an Apprise API URL so it always ends with /notify.
 *
 * Rules:
 *  - Strip trailing slash.
 *  - If the path already ends with /notify, leave it as-is.
 *  - Otherwise, append /notify.
 *
 * Examples:
 *  http://apprise:8000       → http://apprise:8000/notify
 *  http://apprise:8000/      → http://apprise:8000/notify
 *  http://apprise:8000/notify → http://apprise:8000/notify
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
 *
 * POST /message
 * Content-Type: application/json
 * X-Gotify-Key: <token>
 * Body: { "title": "...", "message": "...", "priority": 8 }
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
      err instanceof Error && "code" in err
        ? `Could not reach Gotify from the REMI Bloom server (${err.message})`
        : `Could not reach Gotify from the REMI Bloom server`;
    return { success: false, error: message };
  }
}

/**
 * Send a notification via Apprise API.
 *
 * POST /notify
 * Content-Type: application/json
 * Body: { "title": "...", "body": "...", "type": "info", "tag": "remi-bloom" }
 *
 * If a token/API key is configured, it is passed as a query parameter
 * (the standard Apprise API auth mechanism).
 */
async function sendApprise(
  config: ServerNotificationConfig,
  payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = normaliseAppriseUrl(config.url);
  const apiUrl = new URL(baseUrl);

  // Apprise API supports token-based auth via query parameter
  if (config.token) {
    apiUrl.searchParams.set("token", config.token);
  }

  try {
    const response = await fetch(apiUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        type: "info",
        tag: "remi-bloom",
      }),
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
      err instanceof Error && "code" in err
        ? `Could not reach Apprise from the REMI Bloom server (${err.message})`
        : `Could not reach Apprise from the REMI Bloom server`;
    return { success: false, error: message };
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Send a notification via the configured engine (server-side).
 * Returns a result object indicating success or failure.
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
