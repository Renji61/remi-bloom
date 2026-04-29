import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { plants } from "@/db/schema/plants";
import { careEvents } from "@/db/schema/care-events";
import { journalEntries } from "@/db/schema/journal";
import { progressEntries } from "@/db/schema/progress";
import { reminders } from "@/db/schema/reminders";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(plants)
    .where(and(eq(plants.id, id), eq(plants.userId, userId)))
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  const updateData: Record<string, any> = {};
  const fields = [
    "name", "scientificName", "description", "emoji", "imageUrl",
    "plantedDate", "locationId", "tags", "gardenX", "gardenY", "gardenPlaced",
  ];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  await db
    .update(plants)
    .set(updateData)
    .where(and(eq(plants.id, id), eq(plants.userId, userId)));

  const updated = await db
    .select()
    .from(plants)
    .where(and(eq(plants.id, id), eq(plants.userId, userId)))
    .then((r) => r[0]);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const db = getDb();

  const existing = await db
    .select()
    .from(plants)
    .where(and(eq(plants.id, id), eq(plants.userId, userId)))
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(plants).where(and(eq(plants.id, id), eq(plants.userId, userId)));
    await tx
      .delete(careEvents)
      .where(and(eq(careEvents.plantId, id), eq(careEvents.userId, userId)));
    await tx
      .delete(journalEntries)
      .where(and(eq(journalEntries.plantId, id), eq(journalEntries.userId, userId)));
    await tx
      .delete(progressEntries)
      .where(and(eq(progressEntries.plantId, id), eq(progressEntries.userId, userId)));
    await tx
      .delete(reminders)
      .where(and(eq(reminders.plantId, id), eq(reminders.userId, userId)));
  });

  return NextResponse.json({ success: true });
}
