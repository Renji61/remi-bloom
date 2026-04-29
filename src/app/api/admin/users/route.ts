import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema/auth";
import { auditLogs } from "@/db/schema/audit-logs";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { generateId } from "@/lib/utils";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 4;
const ROLES = new Set(["admin", "user"]);

export async function GET() {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  if (authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const result = await db.select().from(users);
  return NextResponse.json(result.map((user) => ({ ...user, passwordHash: "" })));
}

export async function POST(request: NextRequest) {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  if (authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const db = getDb();
  const username = String(body.username ?? "").trim().toLowerCase();
  const displayName = String(body.displayName ?? "").trim();
  const password = String(body.password ?? "");
  const email = String(body.email ?? "").trim();
  const role = ROLES.has(body.role) ? body.role : "user";

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

  // Check if username exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .then((r) => r[0]);

  if (existing) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const passwordHash = await hash(password, 12);

  const user = {
    id: generateId(),
    username,
    displayName,
    passwordHash,
    role,
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
    userId: authUser.id,
    username: authUser.username,
    action: "create_user",
    details: `Created user ${user.username}`,
    timestamp: now,
  });

  return NextResponse.json({ ...user, passwordHash: "" }, { status: 201 });
}
