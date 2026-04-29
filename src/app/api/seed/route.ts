import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema/auth";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { generateId } from "@/lib/utils";

/**
 * GET /api/seed — Creates default admin/user accounts if none exist.
 * Safe to call multiple times — only seeds if the users table is empty.
 */
export async function GET(request: NextRequest) {
  const db = getDb();
  const configuredSecret = process.env.REMI_BLOOM_SEED_SECRET;
  const suppliedSecret =
    request.headers.get("x-seed-secret") ??
    request.nextUrl.searchParams.get("secret");
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && (!configuredSecret || suppliedSecret !== configuredSecret)) {
    return NextResponse.json({ error: "Seed endpoint disabled" }, { status: 404 });
  }

  if (!isProduction && configuredSecret && suppliedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Invalid seed secret" }, { status: 403 });
  }

  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ seeded: false, message: "Users already exist" });
  }

  const now = new Date().toISOString();

  const adminUser = {
    id: "user-admin",
    username: "admin",
    displayName: "Administrator",
    passwordHash: await hash("admin", 12),
    role: "admin" as const,
    email: "admin@remibloom.local",
    avatar: "",
    active: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const defaultUser = {
    id: "user-default",
    username: "user",
    displayName: "Gardener",
    passwordHash: await hash("user", 12),
    role: "user" as const,
    email: "user@remibloom.local",
    avatar: "",
    active: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(users).values([adminUser, defaultUser]);

  const responseUsers = [
    isProduction
      ? { username: "admin", role: "admin" }
      : { username: "admin", password: "admin", role: "admin" },
    isProduction
      ? { username: "user", role: "user" }
      : { username: "user", password: "user", role: "user" },
  ];

  return NextResponse.json({ seeded: true, users: responseUsers });
}
