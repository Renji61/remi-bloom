import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type AuthUser = {
  id: string;
  username: string;
  role: string;
};

/**
 * Require authentication for an API route handler.
 * Returns the user ID on success, or a 401 NextResponse on failure.
 */
export async function requireAuth(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user.id;
}

/**
 * Require authentication and return full user info.
 */
export async function requireAuthUser(): Promise<AuthUser | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return {
    id: session.user.id,
    username: session.user.username ?? "",
    role: session.user.role ?? "user",
  };
}
