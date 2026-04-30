import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/api-auth";
import { getDb } from "@/db";
import { plants } from "@/db/schema/plants";
import { careEvents } from "@/db/schema/care-events";
import { plantLocations } from "@/db/schema/locations";
import { tags } from "@/db/schema/tags";
import { inventoryItems } from "@/db/schema/inventory";
import { journalEntries } from "@/db/schema/journal";
import { gardenCells } from "@/db/schema/garden-cells";
import { reminders } from "@/db/schema/reminders";
import { todos } from "@/db/schema/todos";
import { progressEntries } from "@/db/schema/progress";
import { sharedGardens } from "@/db/schema/shared-gardens";
import { actionItems } from "@/db/schema/action-items";
import { settings } from "@/db/schema/settings";
import { eq, or } from "drizzle-orm";

export async function DELETE() {
  const authUser = await requireAuthUser();
  if (authUser instanceof NextResponse) return authUser;

  const db = getDb();
  const userId = authUser.id;

  // Clear all user-specific data from Postgres
  await db.delete(plants).where(eq(plants.userId, userId));
  await db.delete(careEvents).where(eq(careEvents.userId, userId));
  await db.delete(plantLocations).where(eq(plantLocations.userId, userId));
  await db.delete(tags).where(eq(tags.userId, userId));
  await db.delete(inventoryItems).where(eq(inventoryItems.userId, userId));
  await db.delete(journalEntries).where(eq(journalEntries.userId, userId));
  await db.delete(gardenCells).where(eq(gardenCells.userId, userId));
  await db.delete(reminders).where(eq(reminders.userId, userId));
  await db.delete(todos).where(eq(todos.userId, userId));
  await db.delete(progressEntries).where(eq(progressEntries.userId, userId));
  await db.delete(actionItems).where(eq(actionItems.userId, userId));

  // sharedGardens uses ownerId instead of userId
  await db.delete(sharedGardens).where(eq(sharedGardens.ownerId, userId));

  // settings has no userId column, delete by key prefix
  await db.delete(settings).where(eq(settings.key, `${userId}:themeMode`));
  await db.delete(settings).where(eq(settings.key, `${userId}:themeColor`));
  await db.delete(settings).where(eq(settings.key, `${userId}:currencyCode`));
  await db.delete(settings).where(eq(settings.key, `${userId}:currencySymbol`));
  await db.delete(settings).where(eq(settings.key, `${userId}:faviconUrl`));
  await db.delete(settings).where(eq(settings.key, `${userId}:plantidApiKey`));
  await db.delete(settings).where(eq(settings.key, `${userId}:perenualApiKey`));
  await db.delete(settings).where(eq(settings.key, `${userId}:weatherApiKey`));
  await db.delete(settings).where(eq(settings.key, `${userId}:weatherLocation`));
  await db.delete(settings).where(eq(settings.key, `${userId}:weatherLat`));
  await db.delete(settings).where(eq(settings.key, `${userId}:weatherLon`));
  await db.delete(settings).where(eq(settings.key, `${userId}:notificationEngine`));
  await db.delete(settings).where(eq(settings.key, `${userId}:notificationUrl`));
  await db.delete(settings).where(eq(settings.key, `${userId}:notificationToken`));
  await db.delete(settings).where(eq(settings.key, `${userId}:useWeatherAlerts`));
  await db.delete(settings).where(eq(settings.key, `${userId}:useCareAlerts`));

  return NextResponse.json({ success: true, message: "All user data cleared" });
}
