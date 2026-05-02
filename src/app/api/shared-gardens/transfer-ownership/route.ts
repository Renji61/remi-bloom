import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/shared-gardens/transfer-ownership
 * Body: { gardenId: string, newOwnerId: string }
 * Only the current owner can call this.
 * Swaps roles: old owner → caretaker, selected caretaker → owner.
 */
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

    const { gardenId, newOwnerId } = body;
    if (!gardenId || !newOwnerId) {
      return NextResponse.json(
        { error: "gardenId and newOwnerId are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const garden: any = await db
      .select()
      .from(sharedGardens)
      .where(eq(sharedGardens.id, gardenId))
      .then((rows) => rows[0]);

    if (!garden) {
      return NextResponse.json({ error: "Garden not found" }, { status: 404 });
    }

    // Only the owner can transfer
    if (garden.ownerId !== userId) {
      return NextResponse.json(
        { error: "Only the garden owner can transfer ownership" },
        { status: 403 }
      );
    }

    const members = garden.members as any[];

    // Find the new owner in members
    const newOwnerMember = members.find((m: any) => m.id === newOwnerId);
    if (!newOwnerMember) {
      return NextResponse.json(
        { error: "New owner must be an existing member" },
        { status: 400 }
      );
    }

    // Update the members array
    const updatedMembers = members.map((m: any) => {
      if (m.id === userId) {
        // Old owner becomes caretaker
        return {
          ...m,
          role: "caretaker" as const,
          scope: newOwnerMember.scope || { type: "full" as const, locationIds: [], plantIds: [] },
        };
      }
      if (m.id === newOwnerId) {
        // Selected member becomes owner
        return {
          ...m,
          role: "owner" as const,
          scope: { type: "full" as const, locationIds: [], plantIds: [] },
        };
      }
      return m;
    });

    await db.transaction(async (tx: any) => {
      await tx
        .update(sharedGardens)
        .set({
          ownerId: newOwnerId,
          members: updatedMembers as any,
        })
        .where(eq(sharedGardens.id, gardenId));
    });

    // Fetch the updated garden to return fresh data
    const updatedGarden: any = await db
      .select()
      .from(sharedGardens)
      .where(eq(sharedGardens.id, gardenId))
      .then((rows) => rows[0]);

    return NextResponse.json({
      success: true,
      message: "Ownership transferred successfully.",
      garden: updatedGarden,
    });
  } catch (err) {
    console.error("Error transferring ownership:", err);
    return NextResponse.json(
      { error: "Failed to transfer ownership. The server may be unavailable." },
      { status: 500 }
    );
  }
}
