import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDb } from "@/db";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { eq, or, sql } from "drizzle-orm";

/**
 * POST /api/shared-gardens/join
 * Body: { code: string }
 * Adds current user as member using the matching pending invite.
 * Returns the garden with the user's role and scope.
 */
export async function POST(request: NextRequest) {
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

  // Fetch the garden and its user for display name
  const garden = await db
    .select()
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

  // Check for matching pending invite
  const pendingInvites = (garden.pendingInvites || []) as any[];
  const matchingInvite = pendingInvites.find(
    (invite: any) => invite.code === normalizedCode
  );

  if (!matchingInvite) {
    return NextResponse.json(
      { error: "This invite code is no longer valid. Contact the garden owner." },
      { status: 410 }
    );
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
    role: matchingInvite.role,
    scope: matchingInvite.scope,
    addedAt: new Date().toISOString(),
    invitedBy: garden.ownerId,
  };

  // Remove the used invite from pendingInvites
  const updatedPendingInvites = pendingInvites.filter(
    (invite: any) => invite.code !== normalizedCode
  );

  const updatedMembers = [...members, newMember];

  // Update the garden in the database
  // Use a raw SQL approach to handle JSONB arrays
  await db
    .update(sharedGardens)
    .set({
      members: updatedMembers as any,
      pendingInvites: updatedPendingInvites as any,
    })
    .where(eq(sharedGardens.id, garden.id));

  return NextResponse.json({
    success: true,
    garden: {
      id: garden.id,
      gardenName: garden.gardenName,
      ownerId: garden.ownerId,
      ownerName: owner?.displayName ?? "Unknown",
      members: updatedMembers,
      sharedPlantIds: garden.sharedPlantIds,
      role: matchingInvite.role,
      scope: matchingInvite.scope,
      memberCount: updatedMembers.length,
    },
  });
}
