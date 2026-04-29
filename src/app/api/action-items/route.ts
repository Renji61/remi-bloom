import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { actionItems } from "@/db/schema/action-items";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.userId, userId));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const item = {
    id: body.id ?? generateId(),
    userId,
    title: body.title,
    source: body.source ?? "manual",
    type: body.type,
    date: body.date,
    time: body.time ?? "",
    completed: body.completed ?? false,
    plantIds: body.plantIds ?? [],
    plantNames: body.plantNames ?? [],
    note: body.note ?? "",
    repeat: body.repeat ?? "none",
    repeatConfig: body.repeatConfig ?? {},
    snoozedUntil: body.snoozedUntil ?? null,
    category: body.category,
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  await db.insert(actionItems).values(item);
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(actionItems)
    .where(
      and(eq(actionItems.id, body.id), eq(actionItems.userId, userId))
    )
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  await db
    .update(actionItems)
    .set({
      title: body.title ?? existing.title,
      completed: body.completed ?? existing.completed,
      note: body.note ?? existing.note,
      date: body.date ?? existing.date,
      time: body.time ?? existing.time,
      snoozedUntil: body.snoozedUntil ?? existing.snoozedUntil,
      plantIds: body.plantIds ?? existing.plantIds,
      plantNames: body.plantNames ?? existing.plantNames,
    })
    .where(and(eq(actionItems.id, body.id), eq(actionItems.userId, userId)));

  const updated = await db
    .select()
    .from(actionItems)
    .where(and(eq(actionItems.id, body.id), eq(actionItems.userId, userId)))
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
    .delete(actionItems)
    .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)));

  return NextResponse.json({ success: true });
}
