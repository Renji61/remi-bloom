import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { reminders } from "@/db/schema/reminders";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const reminder = {
    id: body.id ?? generateId(),
    userId,
    title: body.title,
    plantId: body.plantId ?? null,
    plantName: body.plantName ?? "",
    type: body.type,
    date: body.date,
    time: body.time ?? "",
    repeat: body.repeat ?? "none",
    repeatInterval: body.repeatInterval ?? 1,
    note: body.note ?? "",
    completed: body.completed ?? false,
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  await db.insert(reminders).values(reminder);
  return NextResponse.json(reminder, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(reminders)
    .where(
      and(eq(reminders.id, body.id), eq(reminders.userId, userId))
    )
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  await db
    .update(reminders)
    .set({
      title: body.title ?? existing.title,
      plantId: body.plantId !== undefined ? body.plantId : existing.plantId,
      plantName: body.plantName ?? existing.plantName,
      type: body.type ?? existing.type,
      date: body.date ?? existing.date,
      time: body.time ?? existing.time,
      repeat: body.repeat ?? existing.repeat,
      repeatInterval: body.repeatInterval ?? existing.repeatInterval,
      note: body.note ?? existing.note,
      completed: body.completed ?? existing.completed,
    })
    .where(and(eq(reminders.id, body.id), eq(reminders.userId, userId)));

  const updated = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, body.id), eq(reminders.userId, userId)))
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
    .delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)));

  return NextResponse.json({ success: true });
}
