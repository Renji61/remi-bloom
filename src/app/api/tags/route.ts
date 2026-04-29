import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { tags } from "@/db/schema/tags";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, userId));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const tag = {
    id: body.id ?? generateId(),
    userId,
    name: body.name,
    color: body.color ?? "#6366f1",
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  await db.insert(tags).values(tag);
  return NextResponse.json(tag, { status: 201 });
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
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)));

  return NextResponse.json({ success: true });
}
