import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq, and, or, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils";

export async function GET() {
  try {
    const userId = await requireAuth();
    if (userId instanceof NextResponse) return userId;

    const db = getDb();
    // Gardens where user is owner OR member
    const result = await db
      .select()
      .from(sharedGardens)
      .where(
        or(
          eq(sharedGardens.ownerId, userId),
          sql`${sharedGardens.members} @> ${JSON.stringify([{ id: userId }])}::jsonb`
        )
      );

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error fetching shared gardens:", err);
    return NextResponse.json(
      { error: "Failed to fetch shared gardens" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth();
    if (userId instanceof NextResponse) return userId;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.gardenName?.trim()) {
      return NextResponse.json({ error: "Garden name is required" }, { status: 400 });
    }
    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const db = getDb();

    const garden = {
      id: body.id ?? generateId(),
      ownerId: userId,
      gardenName: body.gardenName.trim(),
      code: body.code.toUpperCase(),
      createdAt: body.createdAt ?? new Date().toISOString(),
      members: body.members ?? [],
      sharedPlantIds: body.sharedPlantIds ?? [],
      pendingInvites: body.pendingInvites ?? [],
    };

    // Use upsert: if the garden ID already exists (e.g. from a previous partial
    // creation or sync race), update it instead of failing on unique constraint.
    const existing = await db
      .select({ id: sharedGardens.id })
      .from(sharedGardens)
      .where(eq(sharedGardens.id, garden.id))
      .then((rows) => rows[0]);

    if (existing) {
      await db
        .update(sharedGardens)
        .set({
          gardenName: garden.gardenName,
          code: garden.code,
          members: garden.members,
          sharedPlantIds: garden.sharedPlantIds,
          pendingInvites: garden.pendingInvites,
        })
        .where(eq(sharedGardens.id, garden.id));
    } else {
      await db.insert(sharedGardens).values(garden);
    }

    return NextResponse.json(garden, { status: 201 });
  } catch (err: any) {
    console.error("Error creating shared garden:", err);
    // Handle unique constraint violation on code
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "A garden with this invite code already exists. Try again." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create garden. The server may be unavailable." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireAuth();
    if (userId instanceof NextResponse) return userId;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const db = getDb();

    const existing = await db
      .select()
      .from(sharedGardens)
      .where(
        and(eq(sharedGardens.id, body.id), eq(sharedGardens.ownerId, userId))
      )
      .then((r) => r[0]);

    if (!existing) {
      return NextResponse.json(
        { error: "Garden not found or not owner" },
        { status: 404 }
      );
    }

    await db
      .update(sharedGardens)
      .set({
        gardenName: body.gardenName ?? existing.gardenName,
        members: body.members ?? existing.members,
        sharedPlantIds: body.sharedPlantIds ?? existing.sharedPlantIds,
      })
      .where(and(eq(sharedGardens.id, body.id), eq(sharedGardens.ownerId, userId)));

    const updated = await db
      .select()
      .from(sharedGardens)
      .where(and(eq(sharedGardens.id, body.id), eq(sharedGardens.ownerId, userId)))
      .then((r) => r[0]);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating shared garden:", err);
    return NextResponse.json(
      { error: "Failed to update garden" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireAuth();
    if (userId instanceof NextResponse) return userId;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const db = getDb();
    await db
      .delete(sharedGardens)
      .where(
        and(eq(sharedGardens.id, id), eq(sharedGardens.ownerId, userId))
      );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting shared garden:", err);
    return NextResponse.json(
      { error: "Failed to delete garden" },
      { status: 500 }
    );
  }
}
