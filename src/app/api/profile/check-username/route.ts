import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema/auth";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ available: false, error: "Username parameter is required" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase().trim()))
    .then((rows) => rows[0]);

  const isOwnUsername = existing?.id === authUser.id;
  return NextResponse.json({ available: !existing || isOwnUsername });
}
