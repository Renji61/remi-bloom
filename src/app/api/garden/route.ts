import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { gardenCells } from "@/db/schema/garden-cells";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(gardenCells)
    .where(eq(gardenCells.userId, userId));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  // body.cells should be an array of GardenCell objects
  if (!body.cells || !Array.isArray(body.cells)) {
    return NextResponse.json(
      { error: "cells array required" },
      { status: 400 }
    );
  }

  // Replace all cells for this user
  await db.transaction(async (tx) => {
    await tx.delete(gardenCells).where(eq(gardenCells.userId, userId));
    if (body.cells.length > 0) {
      const values = body.cells.map((cell: any) => ({
        id: cell.id,
        userId,
        x: cell.x,
        y: cell.y,
        plantId: cell.plantId ?? null,
        plantName: cell.plantName ?? null,
        plantEmoji: cell.plantEmoji ?? null,
        placedAt: cell.placedAt ?? null,
      }));
      await tx.insert(gardenCells).values(values);
    }
  });

  return NextResponse.json({ success: true });
}
