import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema/auth";
import { auditLogs } from "@/db/schema/audit-logs";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { generateId } from "@/lib/utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 4;

export async function GET() {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  const db = getDb();
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .then((rows) => rows[0]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ...user, passwordHash: "" });
}

export async function PATCH(request: NextRequest) {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  const body = await request.json();
  const db = getDb();
  const now = new Date().toISOString();
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .then((rows) => rows[0]);

  if (!existingUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updateData: Record<string, string> = { updatedAt: now };
  const auditActions: string[] = [];

  if (body.displayName !== undefined) {
    const displayName = String(body.displayName).trim();
    if (!displayName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }
    updateData.displayName = displayName;
    auditActions.push("profile_update");
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim();
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    updateData.email = email;
    auditActions.push("profile_update");
  }

  if (body.newPassword !== undefined) {
    const newPassword = String(body.newPassword);
    const currentPassword = String(body.currentPassword ?? "");
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    const validCurrentPassword = await compare(
      currentPassword,
      existingUser.passwordHash
    );
    if (!validCurrentPassword) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }
    updateData.passwordHash = await hash(newPassword, 12);
    auditActions.push("password_change");
  }

  await db.update(users).set(updateData).where(eq(users.id, authUser.id));

  for (const action of new Set(auditActions)) {
    await db.insert(auditLogs).values({
      id: generateId(),
      userId: authUser.id,
      username: authUser.username,
      action,
      details: action === "password_change" ? "User changed password" : "User updated profile",
      timestamp: now,
    });
  }

  const updated = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .then((rows) => rows[0]);

  return NextResponse.json({ ...updated, passwordHash: "" });
}
