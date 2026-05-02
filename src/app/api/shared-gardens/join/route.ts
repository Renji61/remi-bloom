import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/shared-gardens/join
 * Body: { code: string }
 * Adds current user as member using the matching pending invite.
 * Returns the garden with the user's role and scope.
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

    const { code } = body;
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < 4) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
    }

    const db = getDb();

    // Fetch the garden by its invite code
    const garden: any = await db
      .select({
        id: sharedGardens.id,
        ownerId: sharedGardens.ownerId,
        gardenName: sharedGardens.gardenName,
        code: sharedGardens.code,
        createdAt: sharedGardens.createdAt,
        members: sharedGardens.members,
        sharedPlantIds: sharedGardens.sharedPlantIds,
      })
      .from(sharedGardens)
      .where(eq(sharedGardens.code, normalizedCode))
      .then((rows) => rows[0]);

    if (!garden) {
      return NextResponse.json({ error: "Garden not found" }, { status: 404 });
    }

    // Get the current user's display name
    const { users } = await import("@/db/schema/auth");
    const user = await db
      .select({
        id: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .then((rows) => rows[0]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already a member
    const members = garden.members as any[];
    if (members.some((m: any) => m.id === userId)) {
      return NextResponse.json(
        { error: "You are already a member of this garden" },
        { status: 409 }
      );
    }

    // Look up pending invites for role/scope metadata.
    // If the column doesn't exist yet (pre-migration), fall back to defaults.
    let role = "caretaker";
    let scope: any = { type: "full", locationIds: [], plantIds: [] };
    let pendingInvites: any[] = [];

    try {
      pendingInvites = (garden.pendingInvites || []) as any[];
      const matchingInvite = pendingInvites.find(
        (invite: any) => invite.code === normalizedCode
      );
      if (matchingInvite) {
        role = matchingInvite.role || role;
        scope = matchingInvite.scope || scope;
      }
    } catch {
      // pendingInvites column may not exist yet; use defaults
      console.warn("pendingInvites not available, using defaults");
    }

    // Get owner's display name for invitedBy
    const owner = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, garden.ownerId))
      .then((rows) => rows[0]);

    // Add the user as a member
    const newMember = {
      id: userId,
      name: user.displayName,
      role,
      scope,
      addedAt: new Date().toISOString(),
      invitedBy: garden.ownerId,
    };

    const updatedMembers = [...members, newMember];

    // Update the garden in the database — only update members,
    // skip pendingInvites in case the column doesn't exist yet.
    try {
      const updatedPendingInvites = pendingInvites.filter(
        (invite: any) => invite.code !== normalizedCode
      );
      await db
        .update(sharedGardens)
        .set({
          members: updatedMembers as any,
          pendingInvites: updatedPendingInvites as any,
        })
        .where(eq(sharedGardens.id, garden.id));
    } catch (updateErr) {
      // Column may not exist yet — try without pendingInvites
      console.warn("Failed to update pendingInvites, retrying without:", updateErr);
      await db
        .update(sharedGardens)
        .set({ members: updatedMembers as any })
        .where(eq(sharedGardens.id, garden.id));
    }

    return NextResponse.json({
      success: true,
      garden: {
        id: garden.id,
        gardenName: garden.gardenName,
        ownerId: garden.ownerId,
        ownerName: owner?.displayName ?? "Unknown",
        members: updatedMembers,
        sharedPlantIds: garden.sharedPlantIds,
        role,
        scope,
        memberCount: updatedMembers.length,
      },
    });
  } catch (err) {
    console.error("Error joining shared garden:", err);
    return NextResponse.json(
      { error: "Failed to join garden. The server may be unavailable." },
      { status: 500 }
    );
  }
}
