import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api-auth";
import { getDb } from "@/db";
import { settings } from "@/db/schema/settings";
import { eq } from "drizzle-orm";

/**
 * GET /api/registration-status
 *
 * Returns whether open registration is currently enabled.
 * No auth required — the registration page calls this to show/hide the form.
 */
export async function GET(_request: NextRequest) {
  const db = getDb();

  // Check env var first (admin's static preference)
  if (process.env.DISABLE_OPEN_REGISTRATION === "true") {
    return NextResponse.json({ open: false, envLocked: true });
  }

  // Check database setting (can be toggled at runtime by an admin)
  const setting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "__server:disable_open_registration"))
    .then((r) => r[0]);

  return NextResponse.json({ open: setting?.value !== "true", envLocked: false });
}

/**
 * POST /api/registration-status
 *
 * Toggles open registration on/off. Only admin users can call this.
 */
export async function POST(request: NextRequest) {
  const user = await requireAuthUser();
  if (user instanceof NextResponse) return user;

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const open = body.open === true;

  const db = getDb();
  await db
    .insert(settings)
    .values({ key: "__server:disable_open_registration", value: open ? "false" : "true" })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: open ? "false" : "true" },
    });

  return NextResponse.json({ open });
}
