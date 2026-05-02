import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq, or, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

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

    // Authenticate first so any session DB errors happen before the main query
    let currentUserId: string | null = null;
    try {
      const authResult = await requireAuth();
      if (typeof authResult === "string") {
        currentUserId = authResult;
      }
    } catch (authErr) {
      console.error("Auth check failed in garden lookup (non-fatal):", authErr);
      // Non-fatal — the lookup is public; we just won't know if the user is a member
    }

    const db = getDb();
    const normalizedCode = code.toUpperCase();
    let garden: any;
    try {
      garden = await db
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
    } catch (queryErr) {
      console.error("Database query failed in garden lookup:", queryErr);
      return NextResponse.json(
        { error: "Database error during lookup. Please try again." },
        { status: 500 }
      );
    }

    if (!garden) {
      return NextResponse.json({ error: "Garden not found" }, { status: 404 });
    }

    // Check if the current user is already a member
    let isCurrentUserMember = false;
    if (currentUserId) {
      try {
        const members = garden.members as any[];
        isCurrentUserMember = members.some((m: any) => m.id === currentUserId);
      } catch (memberErr) {
        console.error("Error checking membership:", memberErr);
      }
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
      pendingInvites: pendingInvites.map((inv: any) => ({
        code: inv.code,
        role: inv.role,
        scope: inv.scope,
      })),
    });
  } catch (err) {
    console.error("Unexpected error in shared-gardens lookup:", err);
    return NextResponse.json(
      { error: "Failed to look up garden. The server may be unavailable." },
      { status: 500 }
    );
  }
}
