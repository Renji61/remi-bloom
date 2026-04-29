import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api-auth";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  if (authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const result = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(50);

  return NextResponse.json(result);
}
