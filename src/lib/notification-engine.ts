"use client";

/**
 * Notification Engine for REMI Bloom
 *
 * Supports two engines:
 *  1. Gotify — sends directly to a Gotify server via its REST API
 *  2. Apprise — sends to an Apprise API container which can relay to
 *     Gotify, Telegram, Email, and many other services via Apprise URL syntax.
 *
 * Apprise URLs are documented at: https://github.com/caronc/apprise
 *
 * Known settings keys (persisted in IndexedDB via getSetting/setSetting):
 *  - notificationEngine: "gotify" | "apprise" | "disabled"
 *  - notificationUrl: string (Gotify server URL or Apprise API URL)
 *  - notificationToken: string (Gotify app token or Apprise API key)
 *  - useWeatherAlerts: "true" | "false"
 *  - useCareAlerts: "true" | "false"
 */

// ──────────────────────────────────────────────
// Configuration types
// ──────────────────────────────────────────────

export type NotificationEngine = "disabled" | "gotify" | "apprise";

export interface NotificationConfig {
  engine: NotificationEngine;
  /** For Gotify: the base URL of the Gotify server (e.g. https://gotify.example.com)
   *  For Apprise: the URL of the Apprise API (e.g. http://apprise:8000) */
  url: string;
  /** For Gotify: the app token
   *  For Apprise: the API key (if configured, otherwise empty) */
  token: string;
  /** Whether weather-based alerts are enabled */
  useWeatherAlerts: boolean;
  /** Whether care-reminder alerts are enabled */
  useCareAlerts: boolean;
}

// ──────────────────────────────────────────────
// Alert payload
// ──────────────────────────────────────────────

export interface AlertPayload {
  title: string;
  body: string;
  /** Optional priority for Gotify (0-10) */
  priority?: number;
}

// ──────────────────────────────────────────────
// Engine implementations
// ──────────────────────────────────────────────

/**
 * Send a notification via the configured engine.
 * Returns a result object indicating success or failure.
 */
export async function sendNotification(
  config: NotificationConfig,
  payload: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  if (config.engine === "disabled" || !config.url) {
    return { success: false, error: "Notification engine is disabled or not configured" };
  }

  try {
    switch (config.engine) {
      case "gotify":
        return await sendGotifyNotification(config, payload);
      case "apprise":
        return await sendAppriseNotification(config, payload);
      default:
        return { success: false, error: `Unknown engine: ${config.engine}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending notification";
    return { success: false, error: message };
  }
}

/**
 * Send a notification to a Gotify server.
 *
 * Gotify API: POST /message
 * Content-Type: application/json
 * Body: { "title": "...", "message": "...", "priority": 5 }
 * Auth: X-Gotify-Key header
 */
async function sendGotifyNotification(
  config: NotificationConfig,
  payload: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  const url = `${config.url.replace(/\/+$/, "")}/message`;

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
}

/**
 * Send a notification to an Apprise API server.
 *
 * Apprise API: POST /notify
 * Content-Type: application/json
 * Body: {
 *   "title": "...",
 *   "body": "...",
 *   "type": "info",
 *   "tag": "remi-bloom"
 *   "urls": "..."  // Apprise URL syntax for one or more services
 * }
 *
 * Apprise URLs can target:
 *  - Gotify: gotify://hostname/token
 *  - Telegram: tgram://BOT_TOKEN/CHAT_ID
 *  - Email: mailto://user:pass@smtp.example.com?to=recipient@example.com
 *  - Slack: slack://TOKEN_A/TOKEN_B/TOKEN_C
 *  - Discord: discord://WEBHOOK_ID/WEBHOOK_TOKEN
 *
 * See: https://github.com/caronc/apprise/wiki
 */
async function sendAppriseNotification(
  config: NotificationConfig,
  payload: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  const url = `${config.url.replace(/\/+$/, "")}/notify`;

  // For Apprise, the notificationUrl field contains the Apprise URL(s).
  // Multiple URLs can be separated by a comma or newline.
  // This is stored in config.url but for Apprise, the actual service URLs
  // are stored in the notificationUrl setting key separately.
  // We use config.url as the Apprise API endpoint and need to read the
  // notification URLs from a separate setting.

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // If API key is configured, send it as a token/header
  // Apprise API supports "token" query param or the actual API key
  const apiUrl = new URL(url);
  if (config.token) {
    apiUrl.searchParams.set("token", config.token);
  }

  const response = await fetch(apiUrl.toString(), {
    method: "POST",
    headers,
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
}

// ──────────────────────────────────────────────
// Convenience: send alerts using GET/POST only
// Fallback to a simpler GET-based approach for
// Gotify if fetch-based POST fails due to CORS.
// ──────────────────────────────────────────────

/**
 * Send a notification using a simple GET request (for environments
 * where POST with custom headers is restricted).
 * Only works with Gotify.
 */
export async function sendGotifyViaGET(
  serverUrl: string,
  token: string,
  payload: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const base = serverUrl.replace(/\/+$/, "");
    const url = `${base}/message?token=${encodeURIComponent(token)}&title=${encodeURIComponent(payload.title)}&message=${encodeURIComponent(payload.body)}&priority=${payload.priority ?? 5}`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      return { success: false, error: `Gotify error (${response.status}): ${text}` };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
