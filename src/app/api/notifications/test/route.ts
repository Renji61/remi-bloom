import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  sendServerNotification,
  type ServerNotificationConfig,
  type NotificationEngine,
} from "@/lib/server-notification-engine";

const VALID_ENGINES = new Set(["gotify", "apprise"]);

/**
 * Validate that a URL is safe to call from the server (SSRF protection).
 * Only allows HTTP(S) to non-private IPs.
 * Users can configure Gotify/Apprise on their LAN, so we allow private IPs
 * but block known cloud metadata endpoints and loopback.
 */
function isValidNotificationUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    // Only allow http and https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    // Block loopback explicitly
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname === "::1"
    ) {
      return false;
    }
    // Block cloud metadata endpoints
    const blockedPatterns = [
      "169.254.169.254",
      "metadata.google.internal",
      "100.100.100.200", // aliyun/tencent cloud
    ];
    if (blockedPatterns.some((p) => hostname.includes(p) || hostname === p)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/notifications/test
 *
 * Body: {
 *   engine: "gotify" | "apprise",
 *   url: string,
 *   token: string,
 *   title?: string,
 *   body?: string,
 *   priority?: number,
 * }
 *
 * Sends a notification via the configured engine.
 * The browser only talks to this REMI Bloom API route; the server
 * makes the outbound HTTP call to Gotify/Apprise.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { engine, url, token, title, body: messageBody, priority } = body as {
      engine: string;
      url: string;
      token: string;
      title?: string;
      body?: string;
      priority?: number;
    };

    if (!engine || engine === "disabled") {
      return NextResponse.json(
        { success: false, error: "Notification engine is disabled or not configured" },
        { status: 400 },
      );
    }

    if (!VALID_ENGINES.has(engine)) {
      return NextResponse.json(
        { success: false, error: `Invalid notification engine: "${engine}". Must be "gotify" or "apprise".` },
        { status: 400 },
      );
    }

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Notification URL is required" },
        { status: 400 },
      );
    }

    if (!isValidNotificationUrl(url)) {
      return NextResponse.json(
        { success: false, error: "Invalid or blocked notification URL" },
        { status: 400 },
      );
    }

    const config: ServerNotificationConfig = {
      engine: engine as NotificationEngine,
      url,
      token: token ?? "",
    };

    const result = await sendServerNotification(config, {
      title: title ?? "REMI Bloom — Test Notification",
      body:
        messageBody ??
        "This is a test alert from your REMI Bloom dashboard. If you see this, your notification engine is configured correctly!",
      priority: priority ?? 8,
    });

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: result.error },
      { status: 502 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}
