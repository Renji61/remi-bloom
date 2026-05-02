import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq, or, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";

/**
 * GET /api/shared-gardens/lookup?code=XXXXXXX
 * Public — no auth required (the code IS the auth for lookup).
 * Returns the garden (without members list for privacy) if the code exists.
 * If authenticated, also returns isCurrentUserMember to help the UI.
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length < 4) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const db = getDb();
    const normalizedCode = code.toUpperCase();
    const garden = await db
      .select({
        id: sharedGardens.id,
        gardenName: sharedGardens.gardenName,
        members: sharedGardens.members,
        createdAt: sharedGardens.createdAt,
        pendingInvites: sharedGardens.pendingInvites,
        sharedPlantIds: sharedGardens.sharedPlantIds,
      })
      .from(sharedGardens)
      .where(
        or(
          eq(sharedGardens.code, normalizedCode),
          sql`${sharedGardens.pendingInvites} @> ${JSON.stringify([{ code: normalizedCode }])}::jsonb`
        )
      )
      .then((rows) => rows[0]);

    if (!garden) {
      return NextResponse.json({ error: "Garden not found" }, { status: 404 });
    }

    // Check if the current user is already a member (if authenticated)
    let isCurrentUserMember = false;
    const authResult = await requireAuth();
    if (typeof authResult === "string") {
      const currentUserId = authResult;
      const members = garden.members as any[];
      isCurrentUserMember = members.some((m: any) => m.id === currentUserId);
    }

    const memberCount = (garden.members as any[])?.length ?? 0;
    const sharedPlantIds = (garden.sharedPlantIds as string[]) ?? [];
    const pendingInvites = (garden.pendingInvites as any[]) ?? [];

    return NextResponse.json({
      id: garden.id,
      gardenName: garden.gardenName,
      memberCount,
      createdAt: garden.createdAt,
      isCurrentUserMember,
      sharedPlantIds,
      hasPendingInvites: pendingInvites.length > 0,
      pendingInvites: pendingInvites.map((inv) => ({
        code: inv.code,
        role: inv.role,
        scope: inv.scope,
      })),
    });
  } catch (err) {
    console.error("Error in shared-gardens lookup:", err);
    return NextResponse.json(
      { error: "Failed to look up garden. The server may be unavailable." },
      { status: 500 }
    );
  }
}
