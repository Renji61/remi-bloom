import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  sendServerNotification,
  type ServerNotificationConfig,
  type NotificationEngine,
} from "@/lib/server-notification-engine";

/**
 * POST /api/notifications/test
 *
 * Body: {
 *   engine: "gotify" | "apprise",
 *   url: string,
 *   token: string,
 *   title?: string,      // custom title (defaults to test message)
 *   body?: string,       // custom body (defaults to test message)
 *   priority?: number,   // custom priority (defaults to 8)
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

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Notification URL is required" },
        { status: 400 },
      );
    }

    const config: ServerNotificationConfig = {
      engine: engine as NotificationEngine,
      url,
      token: token ?? "",
    };

    const result = await sendServerNotification(config, {
      title: title ?? "🔔 REMI Bloom — Test Notification",
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
