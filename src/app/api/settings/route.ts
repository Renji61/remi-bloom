import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { settings } from "@/db/schema/settings";
import { eq, like } from "drizzle-orm";

function normalizeUserSettingKey(userId: string, key: string) {
  return key.startsWith(`${userId}:`) ? key.slice(userId.length + 1) : key;
}

export async function GET(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const key = request.nextUrl.searchParams.get("key");
  const db = getDb();

  if (key) {
    const scopedKey = normalizeUserSettingKey(userId, key);
    const entry = await db
      .select()
      .from(settings)
      .where(eq(settings.key, `${userId}:${scopedKey}`))
      .then((r) => r[0]);
    return NextResponse.json({ value: entry?.value ?? null });
  }

  // Return all settings for this user
  const allSettings = await db
    .select()
    .from(settings)
    .where(like(settings.key, `${userId}:%`));

  return NextResponse.json(allSettings);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();
  if (!body.key || typeof body.key !== "string" || typeof body.value !== "string") {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const dbKey = `${userId}:${normalizeUserSettingKey(userId, body.key)}`;
  await db
    .insert(settings)
    .values({ key: dbKey, value: body.value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: body.value },
    });

  return NextResponse.json({ success: true });
}
