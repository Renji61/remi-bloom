import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { careEvents } from "@/db/schema/care-events";
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
      .from(careEvents)
      .where(
        and(
          eq(careEvents.userId, userId),
          eq(careEvents.plantId, plantId)
        )
      )
      .orderBy(desc(careEvents.date));
  } else {
    result = await db
      .select()
      .from(careEvents)
      .where(eq(careEvents.userId, userId))
      .orderBy(desc(careEvents.date));
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const event = {
    id: body.id ?? generateId(),
    userId,
    plantId: body.plantId,
    plantName: body.plantName,
    type: body.type,
    date: body.date,
    note: body.note ?? "",
  };

  await db.insert(careEvents).values(event);
  return NextResponse.json(event, { status: 201 });
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
    .delete(careEvents)
    .where(and(eq(careEvents.id, id), eq(careEvents.userId, userId)));

  return NextResponse.json({ success: true });
}
