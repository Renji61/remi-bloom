import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema/auth";
import { auditLogs } from "@/db/schema/audit-logs";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { generateId } from "@/lib/utils";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 4;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = getDb();
  const username = String(body.username ?? "").trim().toLowerCase();
  const displayName = String(body.displayName ?? "").trim();
  const password = String(body.password ?? "");
  const email = String(body.email ?? "").trim();

  if (!USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-32 characters and contain only letters, numbers, underscores, or hyphens" },
      { status: 400 }
    );
  }
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (email && !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .then((rows) => rows[0]);

  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const user = {
    id: generateId(),
    username,
    displayName,
    passwordHash: await hash(password, 12),
    role: "user" as const,
    email,
    avatar: "",
    active: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(users).values(user);
  await db.insert(auditLogs).values({
    id: generateId(),
    userId: user.id,
    username: user.username,
    action: "register_user",
    details: `Registered user ${user.username}`,
    timestamp: now,
  });

  return NextResponse.json({ ...user, passwordHash: "" }, { status: 201 });
}
