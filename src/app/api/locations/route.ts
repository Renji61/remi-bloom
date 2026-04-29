import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { plantLocations } from "@/db/schema/locations";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(plantLocations)
    .where(eq(plantLocations.userId, userId));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const location = {
    id: body.id ?? generateId(),
    userId,
    name: body.name,
    description: body.description ?? "",
    emoji: body.emoji ?? "",
    imageUrl: body.imageUrl ?? "",
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  await db.insert(plantLocations).values(location);
  return NextResponse.json(location, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(plantLocations)
    .where(
      and(eq(plantLocations.id, body.id), eq(plantLocations.userId, userId))
    )
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  await db
    .update(plantLocations)
    .set({
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      emoji: body.emoji ?? existing.emoji,
      imageUrl: body.imageUrl ?? existing.imageUrl,
    })
    .where(and(eq(plantLocations.id, body.id), eq(plantLocations.userId, userId)));

  const updated = await db
    .select()
    .from(plantLocations)
    .where(and(eq(plantLocations.id, body.id), eq(plantLocations.userId, userId)))
    .then((r) => r[0]);

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(plantLocations)
    .where(and(eq(plantLocations.id, id), eq(plantLocations.userId, userId)));

  return NextResponse.json({ success: true });
}
