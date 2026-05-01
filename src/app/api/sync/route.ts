import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
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
import { and, eq, like, or, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils";

type SyncAction = "create" | "update" | "delete" | "replace";

type SyncOperation = {
  operationId?: string;
  action: SyncAction;
  entity: string;
  recordId?: string;
  data?: any;
};

const MAX_SYNC_OPERATIONS = 100;
const MAX_GARDEN_CELLS = 1000;
const VALID_ACTIONS = new Set<SyncAction>(["create", "update", "delete", "replace"]);

type EntityConfig = {
  table: any;
  idColumn: any;
  ownerColumn: any;
  ownerKey: "userId" | "ownerId";
  createFields: string[];
  updateFields: string[];
  defaults?: (data: any) => Record<string, any>;
};

const entityConfigs: Record<string, EntityConfig> = {
  plant: {
    table: plants,
    idColumn: plants.id,
    ownerColumn: plants.userId,
    ownerKey: "userId",
    createFields: [
      "name",
      "scientificName",
      "description",
      "emoji",
      "imageUrl",
      "createdAt",
      "plantedDate",
      "locationId",
      "tags",
      "gardenX",
      "gardenY",
      "gardenPlaced",
    ],
    updateFields: [
      "name",
      "scientificName",
      "description",
      "emoji",
      "imageUrl",
      "plantedDate",
      "locationId",
      "tags",
      "gardenX",
      "gardenY",
      "gardenPlaced",
    ],
    defaults: () => ({ createdAt: new Date().toISOString(), tags: [] }),
  },
  careEvent: {
    table: careEvents,
    idColumn: careEvents.id,
    ownerColumn: careEvents.userId,
    ownerKey: "userId",
    createFields: ["plantId", "plantName", "type", "date", "note", "performedBy"],
    updateFields: ["plantId", "plantName", "type", "date", "note", "performedBy"],
  },
  location: {
    table: plantLocations,
    idColumn: plantLocations.id,
    ownerColumn: plantLocations.userId,
    ownerKey: "userId",
    createFields: ["name", "description", "emoji", "imageUrl", "createdAt"],
    updateFields: ["name", "description", "emoji", "imageUrl"],
    defaults: () => ({ createdAt: new Date().toISOString() }),
  },
  tag: {
    table: tags,
    idColumn: tags.id,
    ownerColumn: tags.userId,
    ownerKey: "userId",
    createFields: ["name", "color", "createdAt"],
    updateFields: ["name", "color"],
    defaults: () => ({ createdAt: new Date().toISOString() }),
  },
  inventoryItem: {
    table: inventoryItems,
    idColumn: inventoryItems.id,
    ownerColumn: inventoryItems.userId,
    ownerKey: "userId",
    createFields: ["name", "category", "quantity", "unit", "price", "notes", "imageUrl", "createdAt"],
    updateFields: ["name", "category", "quantity", "unit", "price", "notes", "imageUrl"],
    defaults: () => ({ createdAt: new Date().toISOString() }),
  },
  journalEntry: {
    table: journalEntries,
    idColumn: journalEntries.id,
    ownerColumn: journalEntries.userId,
    ownerKey: "userId",
    createFields: ["plantId", "plantName", "note", "date", "photoUrl", "performedBy"],
    updateFields: ["plantId", "plantName", "note", "date", "photoUrl", "performedBy"],
  },
  reminder: {
    table: reminders,
    idColumn: reminders.id,
    ownerColumn: reminders.userId,
    ownerKey: "userId",
    createFields: [
      "title",
      "plantId",
      "plantName",
      "type",
      "date",
      "time",
      "repeat",
      "repeatInterval",
      "note",
      "completed",
      "createdAt",
    ],
    updateFields: [
      "title",
      "plantId",
      "plantName",
      "type",
      "date",
      "time",
      "repeat",
      "repeatInterval",
      "note",
      "completed",
    ],
    defaults: () => ({ createdAt: new Date().toISOString() }),
  },
  todo: {
    table: todos,
    idColumn: todos.id,
    ownerColumn: todos.userId,
    ownerKey: "userId",
    createFields: [
      "title",
      "description",
      "date",
      "time",
      "reminderEnabled",
      "completed",
      "category",
      "createdAt",
    ],
    updateFields: [
      "title",
      "description",
      "date",
      "time",
      "reminderEnabled",
      "completed",
      "category",
    ],
    defaults: () => ({ createdAt: new Date().toISOString() }),
  },
  progressEntry: {
    table: progressEntries,
    idColumn: progressEntries.id,
    ownerColumn: progressEntries.userId,
    ownerKey: "userId",
    createFields: [
      "plantId",
      "plantName",
      "date",
      "height",
      "heightUnit",
      "leafCount",
      "notes",
      "photoUrl",
      "harvestYield",
      "createdAt",
    ],
    updateFields: [
      "plantId",
      "plantName",
      "date",
      "height",
      "heightUnit",
      "leafCount",
      "notes",
      "photoUrl",
      "harvestYield",
    ],
    defaults: () => ({ createdAt: new Date().toISOString() }),
  },
  actionItem: {
    table: actionItems,
    idColumn: actionItems.id,
    ownerColumn: actionItems.userId,
    ownerKey: "userId",
    createFields: [
      "title",
      "source",
      "type",
      "date",
      "time",
      "completed",
      "plantIds",
      "plantNames",
      "note",
      "repeat",
      "repeatConfig",
      "snoozedUntil",
      "category",
      "createdAt",
    ],
    updateFields: [
      "title",
      "source",
      "type",
      "date",
      "time",
      "completed",
      "plantIds",
      "plantNames",
      "note",
      "repeat",
      "repeatConfig",
      "snoozedUntil",
      "category",
    ],
    defaults: () => ({ createdAt: new Date().toISOString(), plantIds: [], plantNames: [], repeatConfig: {} }),
  },
  sharedGarden: {
    table: sharedGardens,
    idColumn: sharedGardens.id,
    ownerColumn: sharedGardens.ownerId,
    ownerKey: "ownerId",
    createFields: ["gardenName", "code", "createdAt", "members", "sharedPlantIds", "pendingInvites"],
    updateFields: ["gardenName", "members", "sharedPlantIds", "pendingInvites"],
    defaults: () => ({ createdAt: new Date().toISOString(), members: [], sharedPlantIds: [], pendingInvites: [] }),
  },
};

const requiredCreateFields: Record<string, string[]> = {
  plant: ["name"],
  careEvent: ["plantId", "plantName", "type", "date"],
  location: ["name"],
  tag: ["name"],
  inventoryItem: ["name", "category"],
  journalEntry: ["plantId", "plantName", "note", "date"],
  reminder: ["title", "type", "date"],
  todo: ["title", "date"],
  progressEntry: ["plantId", "plantName", "date"],
  actionItem: ["title", "source", "type", "date", "category"],
  sharedGarden: ["gardenName", "code"],
};

function pickFields(data: any, fields: string[]) {
  const picked: Record<string, any> = {};
  for (const field of fields) {
    if (data?.[field] !== undefined) picked[field] = data[field];
  }
  return picked;
}

function result(op: SyncOperation, success: boolean, extra: Record<string, any> = {}) {
  return {
    operationId: op.operationId ?? null,
    entity: op.entity,
    action: op.action,
    recordId: op.recordId ?? op.data?.id ?? op.data?.key ?? null,
    success,
    ...extra,
  };
}

async function findById(db: any, config: EntityConfig, id: string) {
  return db.select().from(config.table).where(eq(config.idColumn, id)).then((rows: any[]) => rows[0]);
}

async function findOwned(db: any, config: EntityConfig, id: string, userId: string) {
  return db
    .select()
    .from(config.table)
    .where(and(eq(config.idColumn, id), eq(config.ownerColumn, userId)))
    .then((rows: any[]) => rows[0]);
}

function normalizeSettingKey(userId: string, key: string) {
  return key.startsWith(`${userId}:`) ? key.slice(userId.length + 1) : key;
}

function validateOperationShape(op: any): string | null {
  if (!op || typeof op !== "object") return "Invalid operation";
  if (!VALID_ACTIONS.has(op.action)) return "Invalid action";
  if (!op.entity || typeof op.entity !== "string") return "Invalid entity";
  if (op.data !== undefined && (typeof op.data !== "object" || op.data === null)) {
    return "Invalid operation data";
  }

  if (op.entity === "setting") {
    if (!["create", "update"].includes(op.action)) return "Invalid setting action";
    const key = op.data?.key;
    if (!key || typeof key !== "string" || key.length > 128) return "Invalid setting key";
    if (typeof op.data?.value !== "string") return "Invalid setting value";
    return null;
  }

  if (op.entity === "gardenCells") {
    if (op.action !== "replace") return "Invalid gardenCells action";
    if (!Array.isArray(op.data?.cells)) return "gardenCells requires cells array";
    if (op.data.cells.length > MAX_GARDEN_CELLS) return "Too many garden cells";
    for (const cell of op.data.cells) {
      if (
        !cell ||
        typeof cell !== "object" ||
        typeof cell.x !== "number" ||
        typeof cell.y !== "number"
      ) {
        return "Invalid garden cell";
      }
    }
    return null;
  }

  if (!entityConfigs[op.entity]) return "Unknown operation";
  if (!["create", "update", "delete"].includes(op.action)) return "Invalid entity action";
  if (op.action !== "create" && !String(op.data?.id ?? op.recordId ?? "")) {
    return "id required";
  }

  if (op.action === "create") {
    for (const field of requiredCreateFields[op.entity] ?? []) {
      const value = op.data?.[field];
      if (value === undefined || value === null || value === "") {
        return `${field} required`;
      }
    }
  }

  return null;
}

/**
 * GET /api/sync — Returns ALL user data in one payload.
 * Called on app boot after login to hydrate the Zustand store + IndexedDB.
 */
export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const db = getDb();

  const [
    plantsData,
    careEventsData,
    locationsData,
    tagsData,
    inventoryData,
    journalsData,
    gardenData,
    remindersData,
    todosData,
    progressData,
    sharedGardenData,
    actionItemsData,
    settingsData,
  ] = await Promise.all([
    db.select().from(plants).where(eq(plants.userId, userId)),
    db.select().from(careEvents).where(eq(careEvents.userId, userId)),
    db.select().from(plantLocations).where(eq(plantLocations.userId, userId)),
    db.select().from(tags).where(eq(tags.userId, userId)),
    db.select().from(inventoryItems).where(eq(inventoryItems.userId, userId)),
    db.select().from(journalEntries).where(eq(journalEntries.userId, userId)),
    db.select().from(gardenCells).where(eq(gardenCells.userId, userId)),
    db.select().from(reminders).where(eq(reminders.userId, userId)),
    db.select().from(todos).where(eq(todos.userId, userId)),
    db.select().from(progressEntries).where(eq(progressEntries.userId, userId)),
    db
      .select()
      .from(sharedGardens)
      .where(
        or(
          eq(sharedGardens.ownerId, userId),
          sql`${sharedGardens.members} @> ${JSON.stringify([{ id: userId }])}`
        )
      ),
    db.select().from(actionItems).where(eq(actionItems.userId, userId)),
    db.select().from(settings).where(like(settings.key, `${userId}:%`)),
  ]);

  // Parse settings into a flat map
  const settingsMap: Record<string, string> = {};
  for (const s of settingsData) {
    settingsMap[s.key.replace(`${userId}:`, "")] = s.value;
  }

  return NextResponse.json({
    plants: plantsData,
    careEvents: careEventsData,
    locations: locationsData,
    tags: tagsData,
    inventory: inventoryData,
    journals: journalsData,
    gardenCells: gardenData,
    reminders: remindersData,
    todos: todosData,
    progress: progressData,
    sharedGardens: sharedGardenData,
    actionItems: actionItemsData,
    settings: settingsMap,
  });
}

/**
 * POST /api/sync — Accepts batched CRUD operations (for offline queue replay).
 * Body: { operations: [{ action, entity, data }] }
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
  const db = getDb();

  if (!body.operations || !Array.isArray(body.operations)) {
    return NextResponse.json(
      { error: "operations array required" },
      { status: 400 }
    );
  }
  if (body.operations.length > MAX_SYNC_OPERATIONS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_SYNC_OPERATIONS} operations per sync batch` },
      { status: 413 }
    );
  }

  const results: any[] = [];

  for (const op of body.operations) {
    try {
      const validationError = validateOperationShape(op);
      if (validationError) {
        results.push(result(op ?? {}, false, { error: validationError }));
        continue;
      }

      if (op.entity === "setting") {
        const key = normalizeSettingKey(userId, String(op.data?.key ?? ""));
        if (!key) {
          results.push(result(op, false, { error: "Setting key required" }));
          continue;
        }
        await db
          .insert(settings)
          .values({ key: `${userId}:${key}`, value: String(op.data?.value ?? "") })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: String(op.data?.value ?? "") },
          });
        results.push(result(op, true, { status: "upserted" }));
        continue;
      }

      if (op.entity === "gardenCells") {
        if (op.action !== "replace" || !Array.isArray(op.data?.cells)) {
          results.push(result(op, false, { error: "gardenCells requires replace with cells array" }));
          continue;
        }

        await db.transaction(async (tx: any) => {
          await tx.delete(gardenCells).where(eq(gardenCells.userId, userId));
          if (op.data.cells.length > 0) {
            await tx.insert(gardenCells).values(
              op.data.cells.map((cell: any) => ({
                id: cell.id ?? generateId(),
                userId,
                x: cell.x,
                y: cell.y,
                plantId: cell.plantId ?? null,
                plantName: cell.plantName ?? null,
                plantEmoji: cell.plantEmoji ?? null,
                placedAt: cell.placedAt ?? null,
              }))
            );
          }
        });
        results.push(result(op, true, { status: "replaced" }));
        continue;
      }

      const config = entityConfigs[op.entity];
      if (!config) {
        results.push(result(op, false, { error: "Unknown operation" }));
        continue;
      }

      const id = String(op.data?.id ?? op.recordId ?? "");
      if (!id && op.action !== "create") {
        results.push(result(op, false, { error: "id required" }));
        continue;
      }

      if (op.action === "create") {
        const recordId = String(op.data?.id ?? generateId());
        const existing = await findById(db, config, recordId);
        if (existing && existing[config.ownerKey] !== userId) {
          results.push(result(op, false, { error: "Record belongs to another user" }));
          continue;
        }

        const values = {
          ...(config.defaults?.(op.data) ?? {}),
          ...pickFields(op.data, config.createFields),
          id: recordId,
          [config.ownerKey]: userId,
        };

        if (existing) {
          const updateData = pickFields(values, config.updateFields);
          await db
            .update(config.table)
            .set(updateData)
            .where(and(eq(config.idColumn, recordId), eq(config.ownerColumn, userId)));
          results.push(result(op, true, { status: "updated", recordId }));
        } else {
          await db.insert(config.table).values(values);
          results.push(result(op, true, { status: "created", recordId }));
        }
        continue;
      }

      if (op.action === "update") {
        const existing = await findOwned(db, config, id, userId);
        if (!existing) {
          results.push(result(op, false, { error: "Record not found for user" }));
          continue;
        }

        const updateData = pickFields(op.data, config.updateFields);
        if (Object.keys(updateData).length > 0) {
          await db
            .update(config.table)
            .set(updateData)
            .where(and(eq(config.idColumn, id), eq(config.ownerColumn, userId)));
        }
        results.push(result(op, true, { status: "updated", recordId: id }));
        continue;
      }

      if (op.action === "delete") {
        if (op.entity === "plant") {
          await db.transaction(async (tx: any) => {
            await tx
              .delete(plants)
              .where(and(eq(plants.id, id), eq(plants.userId, userId)));
            await tx
              .delete(careEvents)
              .where(and(eq(careEvents.plantId, id), eq(careEvents.userId, userId)));
            await tx
              .delete(journalEntries)
              .where(and(eq(journalEntries.plantId, id), eq(journalEntries.userId, userId)));
            await tx
              .delete(progressEntries)
              .where(and(eq(progressEntries.plantId, id), eq(progressEntries.userId, userId)));
            await tx
              .delete(reminders)
              .where(and(eq(reminders.plantId, id), eq(reminders.userId, userId)));
          });
        } else {
          await db
            .delete(config.table)
            .where(and(eq(config.idColumn, id), eq(config.ownerColumn, userId)));
        }
        results.push(result(op, true, { status: "deleted", recordId: id }));
        continue;
      }
    } catch (error: any) {
      results.push(result(op, false, { error: error.message }));
    }
  }

  return NextResponse.json({ results });
}
