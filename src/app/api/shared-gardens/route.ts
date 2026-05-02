import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq, and, or, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  // Gardens where user is owner OR member
  const result = await db
    .select()
    .from(sharedGardens)
    .where(
      or(
        eq(sharedGardens.ownerId, userId),
        sql`${sharedGardens.members} @> ${JSON.stringify([{ id: userId }])}`
      )
    );

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const garden = {
    id: body.id ?? generateId(),
    ownerId: userId,
    gardenName: body.gardenName,
    code: body.code,
    createdAt: body.createdAt ?? new Date().toISOString(),
    members: body.members ?? [],
    sharedPlantIds: body.sharedPlantIds ?? [],
    pendingInvites: body.pendingInvites ?? [],
  };

  await db.insert(sharedGardens).values(garden);
  return NextResponse.json(garden, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(sharedGardens)
    .where(
      and(eq(sharedGardens.id, body.id), eq(sharedGardens.ownerId, userId))
    )
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json(
      { error: "Garden not found or not owner" },
      { status: 404 }
    );
  }

  await db
    .update(sharedGardens)
    .set({
      gardenName: body.gardenName ?? existing.gardenName,
      members: body.members ?? existing.members,
      sharedPlantIds: body.sharedPlantIds ?? existing.sharedPlantIds,
    })
    .where(and(eq(sharedGardens.id, body.id), eq(sharedGardens.ownerId, userId)));

  const updated = await db
    .select()
    .from(sharedGardens)
    .where(and(eq(sharedGardens.id, body.id), eq(sharedGardens.ownerId, userId)))
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
    .delete(sharedGardens)
    .where(
      and(eq(sharedGardens.id, id), eq(sharedGardens.ownerId, userId))
    );

  return NextResponse.json({ success: true });
}
