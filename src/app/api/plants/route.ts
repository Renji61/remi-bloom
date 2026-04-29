import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { plants } from "@/db/schema/plants";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();
  const result = await db
    .select()
    .from(plants)
    .where(eq(plants.userId, userId));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();
  const db = getDb();

  const now = new Date().toISOString();
  const plant = {
    id: body.id ?? generateId(),
    userId,
    name: body.name,
    scientificName: body.scientificName ?? "",
    description: body.description ?? "",
    emoji: body.emoji ?? "",
    imageUrl: body.imageUrl ?? "",
    createdAt: body.createdAt ?? now,
    plantedDate: body.plantedDate ?? null,
    locationId: body.locationId ?? null,
    tags: body.tags ?? [],
    gardenX: body.gardenX ?? null,
    gardenY: body.gardenY ?? null,
    gardenPlaced: body.gardenPlaced ?? false,
  };

  await db.insert(plants).values(plant);
  return NextResponse.json(plant, { status: 201 });
}
