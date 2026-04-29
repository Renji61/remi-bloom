import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { progressEntries } from "@/db/schema/progress";
import { eq, desc, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const plantId = request.nextUrl.searchParams.get("plantId");
  const db = getDb();

  let result;
  if (plantId) {
    result = await db
      .select()
      .from(progressEntries)
      .where(
        and(
          eq(progressEntries.userId, userId),
          eq(progressEntries.plantId, plantId)
        )
      )
      .orderBy(desc(progressEntries.date));
  } else {
    result = await db
      .select()
      .from(progressEntries)
      .where(eq(progressEntries.userId, userId))
      .orderBy(desc(progressEntries.date));
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const entry = {
    id: body.id ?? generateId(),
    userId,
    plantId: body.plantId,
    plantName: body.plantName,
    date: body.date,
    height: body.height?.toString() ?? "0",
    heightUnit: body.heightUnit ?? "cm",
    leafCount: body.leafCount ?? 0,
    notes: body.notes ?? "",
    photoUrl: body.photoUrl ?? "",
    harvestYield: body.harvestYield ?? "",
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  await db.insert(progressEntries).values(entry);
  return NextResponse.json(entry, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(progressEntries)
    .where(
      and(
        eq(progressEntries.id, body.id),
        eq(progressEntries.userId, userId)
      )
    )
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await db
    .update(progressEntries)
    .set({
      height: body.height?.toString() ?? existing.height,
      heightUnit: body.heightUnit ?? existing.heightUnit,
      leafCount: body.leafCount ?? existing.leafCount,
      notes: body.notes ?? existing.notes,
      photoUrl: body.photoUrl ?? existing.photoUrl,
      harvestYield: body.harvestYield ?? existing.harvestYield,
    })
    .where(and(eq(progressEntries.id, body.id), eq(progressEntries.userId, userId)));

  const updated = await db
    .select()
    .from(progressEntries)
    .where(and(eq(progressEntries.id, body.id), eq(progressEntries.userId, userId)))
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
    .delete(progressEntries)
    .where(
      and(eq(progressEntries.id, id), eq(progressEntries.userId, userId))
    );

  return NextResponse.json({ success: true });
}
