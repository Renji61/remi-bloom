import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/shared-gardens/leave
 * Body: { gardenId: string }
 * Removes current user from members.
 * If the user is the owner, returns 403 — use transfer-ownership first.
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

    const { gardenId } = body;
    if (!gardenId || typeof gardenId !== "string") {
      return NextResponse.json({ error: "gardenId is required" }, { status: 400 });
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

    // Owner cannot leave — must transfer ownership first
    if (garden.ownerId === userId) {
      return NextResponse.json(
        { error: "Owner cannot leave. Transfer ownership first or delete the garden." },
        { status: 403 }
      );
    }

    const members = garden.members as any[];
    const isMember = members.some((m: any) => m.id === userId);
    if (!isMember) {
      return NextResponse.json({ error: "You are not a member of this garden" }, { status: 404 });
    }

    const updatedMembers = members.filter((m: any) => m.id !== userId);

    await db
      .update(sharedGardens)
      .set({ members: updatedMembers as any })
      .where(eq(sharedGardens.id, gardenId));

    return NextResponse.json({
      success: true,
      message: "You have left the garden.",
      gardenId,
    });
  } catch (err) {
    console.error("Error leaving shared garden:", err);
    return NextResponse.json(
      { error: "Failed to leave garden. The server may be unavailable." },
      { status: 500 }
    );
  }
}
