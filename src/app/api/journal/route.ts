import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { journalEntries } from "@/db/schema/journal";
import { eq, desc, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.date));

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
    note: body.note,
    date: body.date,
    photoUrl: body.photoUrl ?? null,
  };

  await db.insert(journalEntries).values(entry);
  return NextResponse.json(entry, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.id, body.id),
        eq(journalEntries.userId, userId)
      )
    )
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await db
    .update(journalEntries)
    .set({
      note: body.note ?? existing.note,
      photoUrl: body.photoUrl ?? existing.photoUrl,
    })
    .where(and(eq(journalEntries.id, body.id), eq(journalEntries.userId, userId)));

  const updated = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, body.id), eq(journalEntries.userId, userId)))
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
    .delete(journalEntries)
    .where(
      and(eq(journalEntries.id, id), eq(journalEntries.userId, userId))
    );

  return NextResponse.json({ success: true });
}
