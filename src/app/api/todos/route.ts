import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { todos } from "@/db/schema/todos";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const todo = {
    id: body.id ?? generateId(),
    userId,
    title: body.title,
    description: body.description ?? "",
    date: body.date,
    time: body.time ?? "",
    reminderEnabled: body.reminderEnabled ?? false,
    completed: body.completed ?? false,
    category: body.category ?? "general",
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  await db.insert(todos).values(todo);
  return NextResponse.json(todo, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, body.id), eq(todos.userId, userId)))
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  await db
    .update(todos)
    .set({
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      date: body.date ?? existing.date,
      time: body.time ?? existing.time,
      reminderEnabled: body.reminderEnabled ?? existing.reminderEnabled,
      completed: body.completed ?? existing.completed,
      category: body.category ?? existing.category,
    })
    .where(and(eq(todos.id, body.id), eq(todos.userId, userId)));

  const updated = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, body.id), eq(todos.userId, userId)))
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
    .delete(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId)));

  return NextResponse.json({ success: true });
}
