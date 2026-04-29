import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { inventoryItems } from "@/db/schema/inventory";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.userId, userId));

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
    name: body.name,
    category: body.category,
    quantity: body.quantity ?? 0,
    unit: body.unit ?? "",
    price: body.price?.toString() ?? "0",
    notes: body.notes ?? "",
    imageUrl: body.imageUrl ?? "",
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  await db.insert(inventoryItems).values(item);
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const existing = await db
    .select()
    .from(inventoryItems)
    .where(
      and(eq(inventoryItems.id, body.id), eq(inventoryItems.userId, userId))
    )
    .then((r) => r[0]);

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await db
    .update(inventoryItems)
    .set({
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      quantity: body.quantity ?? existing.quantity,
      unit: body.unit ?? existing.unit,
      price: body.price?.toString() ?? existing.price,
      notes: body.notes ?? existing.notes,
      imageUrl: body.imageUrl ?? existing.imageUrl,
    })
    .where(and(eq(inventoryItems.id, body.id), eq(inventoryItems.userId, userId)));

  const updated = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, body.id), eq(inventoryItems.userId, userId)))
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
    .delete(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.userId, userId)));

  return NextResponse.json({ success: true });
}
