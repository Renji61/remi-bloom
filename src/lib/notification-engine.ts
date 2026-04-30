"use client";

/**
 * Client-side Notification Engine for REMI Bloom
 *
 * This module is the public interface used by browser code (hooks, settings).
 * Instead of calling Gotify/Apprise directly (which causes CORS/preflight/
 * private-network errors), it calls the REMI Bloom API route
 * POST /api/notifications/test so the server makes the external HTTP call.
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
// Client-side sender
// ──────────────────────────────────────────────

/**
 * Send a notification via the configured engine.
 *
 * Calls POST /api/notifications/test on the REMI Bloom server, which in
 * turn calls the external Gotify/Apprise service. This avoids CORS and
 * private-network restrictions that would prevent the browser from calling
 * LAN-hosted services directly.
 *
 * Returns a result object indicating success or failure.
 */
export async function sendNotification(
  config: NotificationConfig,
  payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  if (config.engine === "disabled" || !config.url) {
    return { success: false, error: "Notification engine is disabled or not configured" };
  }

  try {
    const response = await fetch("/api/notifications/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: config.engine,
        url: config.url,
        token: config.token,
        title: payload.title,
        body: payload.body,
        priority: payload.priority ?? 5,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: data.error ?? `Server error (${response.status})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error sending notification";
    return { success: false, error: message };
  }
}

/**
 * @deprecated Use sendNotification instead, which now routes through the
 * REMI Bloom API server. This function is kept for backwards compatibility
 * but will always fail because the browser cannot send custom headers to
 * Gotify over private-network boundaries.
 */
export async function sendGotifyViaGET(
  _serverUrl: string,
  _token: string,
  _payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  return {
    success: false,
    error: "Direct browser-to-Gotify requests are no longer supported. Use the REMI Bloom API route instead.",
  };
}
