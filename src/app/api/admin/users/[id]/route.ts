import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema/auth";
import { auditLogs } from "@/db/schema/audit-logs";
import { and, eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { generateId } from "@/lib/utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 4;
const ROLES = new Set(["admin", "user"]);

async function activeAdminCount(db: ReturnType<typeof getDb>) {
  return db
    .select()
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)))
    .then((rows) => rows.length);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  if (authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = getDb();
  const target = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .then((rows) => rows[0]);

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
  const auditDetails: string[] = [];

  if (body.displayName !== undefined) {
    const displayName = String(body.displayName).trim();
    if (!displayName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }
    updateData.displayName = displayName;
    auditDetails.push("display name");
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim();
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    updateData.email = email;
    auditDetails.push("email");
  }

  if (body.role !== undefined) {
    if (!ROLES.has(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (
      target.role === "admin" &&
      target.active &&
      body.role !== "admin" &&
      (await activeAdminCount(db)) <= 1
    ) {
      return NextResponse.json({ error: "Cannot remove the last admin account" }, { status: 400 });
    }
    updateData.role = body.role;
    auditDetails.push("role");
  }

  if (body.active !== undefined) {
    const active = Boolean(body.active);
    if (
      target.role === "admin" &&
      !active &&
      target.active &&
      (await activeAdminCount(db)) <= 1
    ) {
      return NextResponse.json({ error: "Cannot deactivate the last admin account" }, { status: 400 });
    }
    updateData.active = active;
    auditDetails.push(active ? "activated user" : "deactivated user");
  }

  if (body.password !== undefined) {
    const password = String(body.password);
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }
    updateData.passwordHash = await hash(password, 12);
    auditDetails.push("password");
  }

  await db.update(users).set(updateData).where(eq(users.id, id));

  await db.insert(auditLogs).values({
    id: generateId(),
    userId: authUser.id,
    username: authUser.username,
    action: "update_user",
    details: `Updated ${target.username}: ${auditDetails.join(", ") || "no fields"}`,
    timestamp: new Date().toISOString(),
  });

  const updated = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .then((rows) => rows[0]);

  return NextResponse.json({ ...updated, passwordHash: "" });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  if (authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = getDb();

  const target = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .then((r) => r[0]);

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "admin" && target.active) {
    if ((await activeAdminCount(db)) <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last admin account" },
        { status: 400 }
      );
    }
  }

  await db.delete(users).where(eq(users.id, id));

  await db.insert(auditLogs).values({
    id: generateId(),
    userId: authUser.id,
    username: authUser.username,
    action: "delete_user",
    details: `Deleted user ${target.username}`,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
