import Dexie, { type Table } from "dexie";
import { compressImage } from "./image-utils";

export interface Plant {
  id: string;
  userId: string;
  name: string;
  scientificName: string;
  description: string;
  emoji: string;
  imageUrl: string;
  createdAt: string;
  plantedDate: string | null;
  locationId: string | null;
  tags: string[];
  gardenX?: number;
  gardenY?: number;
  gardenPlaced?: boolean;
}

export interface CareEvent {
  id: string;
  userId: string;
  plantId: string;
  plantName: string;
  type: "water" | "fertilize" | "repot" | "prune" | "other";
  date: string;
  note: string;
}

export interface PlantLocation {
  id: string;
  userId: string;
  name: string;
  description: string;
  emoji: string;
  imageUrl: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  userId: string;
  name: string;
  category: "supply" | "seed" | "tool" | "other";
  quantity: number;
  unit: string;
  price: number;
  notes: string;
  imageUrl: string;
  createdAt: string;
}

export interface GardenCell {
  id: string;
  userId: string;
  x: number;
  y: number;
  plantId: string | null;
  plantName: string | null;
  plantEmoji: string | null;
  placedAt: string | null;
}

export interface JournalEntry {
  id: string;
  userId: string;
  plantId: string;
  plantName: string;
  note: string;
  date: string;
  photoUrl?: string;
}

export interface AppSettings {
  key: string;
  value: string;
}

// --- New interfaces ---

export type ReminderType =
  | "water"
  | "fertilize"
  | "mist"
  | "repot"
  | "clean"
  | "seed"
  | "transplant"
  | "other";

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  plantId: string | null;
  plantName: string;
  type: ReminderType;
  date: string;
  time: string;
  repeat: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  repeatInterval: number;
  note: string;
  completed: boolean;
  createdAt: string;
}

export interface Todo {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  reminderEnabled: boolean;
  completed: boolean;
  category: "general" | "watering" | "planting" | "harvesting" | "maintenance";
  createdAt: string;
}

export interface ProgressEntry {
  id: string;
  userId: string;
  plantId: string;
  plantName: string;
  date: string;
  height: number;
  heightUnit: "cm" | "in";
  leafCount: number;
  notes: string;
  photoUrl: string;
  harvestYield: string;
  createdAt: string;
}

export interface SharedGarden {
  id: string;
  ownerId: string;
  gardenName: string;
  code: string;
  createdAt: string;
  members: SharedMember[];
  /** Plant data shared with this garden — array of plant ids */
  sharedPlantIds: string[];
}

export interface SharedMember {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  addedAt: string;
}

export interface UploadedImage {
  id: string;
  userId: string;
  data: Blob;
  mimeType: string;
  name: string;
  createdAt: string;
}

// --- Action Engine ---

export type ActionSource = "system" | "manual";

export type ActionType =
  | "water"
  | "fertilize"
  | "repot"
  | "prune"
  | "mist"
  | "clean"
  | "seed"
  | "transplant"
  | "harvesting"
  | "planting"
  | "maintenance"
  | "general";

export type ActionRepeat =
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "everyXdays"
  | "specificWeekday"
  | "specificMonthday"
  | "ordinalWeekday";

export type Ordinal = "first" | "second" | "third" | "fourth";
export type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export interface RepeatConfig {
  /** For "everyXdays": how many days between repeats */
  intervalDays?: number;
  /** For "specificWeekday": 0=Sun .. 6=Sat */
  weekday?: number;
  /** For "specificMonthday": 1..31 */
  monthday?: number;
  /** For "ordinalWeekday": which ordinal */
  ordinal?: Ordinal;
  /** For "ordinalWeekday": which day */
  ordinalWeekday?: Weekday;
}

export interface ActionItem {
  id: string;
  userId: string;
  title: string;
  source: ActionSource;
  type: ActionType;
  date: string;
  time: string;
  completed: boolean;
  plantIds: string[];
  plantNames: string[];
  note: string;
  repeat: ActionRepeat;
  repeatConfig: RepeatConfig;
  snoozedUntil: string | null;
  category: ActionType;
  createdAt: string;
}

// --- Species Cache for PlantIntelligenceService ---

export interface SpeciesCacheEntry {
  /** Scientific name as the primary key (e.g. "Monstera deliciosa") */
  scientificName: string;
  /** The raw Perenual species data */
  speciesData: PerenualSpecies;
  /** The raw Perenual care guide data */
  careGuideData: PerenualCareGuide | null;
  /** When this was cached */
  cachedAt: string;
}

export interface PerenualSpecies {
  id: number;
  common_name: string;
  scientific_name: string[];
  other_name: string[];
  cycle: string;
  watering: string;
  sunlight: string[];
  default_image: {
    medium_url: string;
    original_url: string;
  } | null;
}

export interface PerenualCareGuide {
  id: number;
  section: PerenualCareSection[];
}

export interface PerenualCareSection {
  type: string;
  description: string;
  simage: {
    id: number;
    image_url: string;
  } | null;
}

// --- User & Auth ---

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  avatar: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  timestamp: string;
}

export type SyncAction = "create" | "update" | "delete" | "replace";

export type SyncEntity =
  | "plant"
  | "careEvent"
  | "location"
  | "tag"
  | "inventoryItem"
  | "journalEntry"
  | "gardenCells"
  | "reminder"
  | "todo"
  | "progressEntry"
  | "sharedGarden"
  | "actionItem"
  | "setting";

export interface SyncQueueOperation {
  id: string;
  operationId: string;
  userId: string;
  entity: SyncEntity;
  action: SyncAction;
  recordId: string;
  data: any;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

// --- Scan/Identification types ---

export interface PlantIdResult {
  name: string;
  confidence: number;
  scientificName: string;
  healthAssessment?: string;
  imageUrl?: string;
}

class RemiBloomDB extends Dexie {
  plants!: Table<Plant, string>;
  careEvents!: Table<CareEvent, string>;
  plantLocations!: Table<PlantLocation, string>;
  tags!: Table<Tag, string>;
  inventoryItems!: Table<InventoryItem, string>;
  journalEntries!: Table<JournalEntry, string>;
  gardenCells!: Table<GardenCell, string>;
  settings!: Table<AppSettings, string>;
  reminders!: Table<Reminder, string>;
  todos!: Table<Todo, string>;
  progressEntries!: Table<ProgressEntry, string>;
  sharedGardens!: Table<SharedGarden, string>;
  uploadedImages!: Table<UploadedImage, string>;
  actionItems!: Table<ActionItem, string>;
  speciesCache!: Table<SpeciesCacheEntry, string>;
  users!: Table<User, string>;
  auditLogs!: Table<AuditLog, string>;
  syncQueue!: Table<SyncQueueOperation, string>;

  constructor() {
    super("RemiBloomDB");
    this.version(5).stores({
      plants: "id, name, locationId, *tags",
      careEvents: "id, plantId, date",
      plantLocations: "id, name",
      tags: "id, name",
      inventoryItems: "id, name, category",
      journalEntries: "id, plantId, date",
      gardenCells: "id, [x+y]",
      settings: "key",
      reminders: "id, date, completed, plantId",
      todos: "id, date, completed",
      progressEntries: "id, plantId, date",
      sharedGardens: "id, code",
      uploadedImages: "id",
    });
    this.version(6).stores({
      actionItems: "id, date, completed, plantId, *type, source",
    });
    this.version(7).stores({
      speciesCache: "scientificName",
    });
    this.version(8).stores({
      users: "id, username, role, active",
      auditLogs: "id, userId, timestamp",
    });
    this.version(9).stores({
      users: "id, username, role, active",
      auditLogs: "id, userId, timestamp",
      plants: "id, userId, name, locationId, *tags",
      careEvents: "id, userId, plantId, date",
      plantLocations: "id, userId, name",
      tags: "id, userId, name",
      inventoryItems: "id, userId, name, category",
      journalEntries: "id, userId, plantId, date",
      gardenCells: "id, userId, [x+y]",
      settings: "key",
      reminders: "id, userId, date, completed, plantId",
      todos: "id, userId, date, completed",
      progressEntries: "id, userId, plantId, date",
      sharedGardens: "id, code",
      uploadedImages: "id, userId",
      actionItems: "id, userId, date, completed, plantId, *type, source",
      speciesCache: "scientificName",
    });
    this.version(10).stores({
      syncQueue:
        "id, operationId, userId, entity, recordId, [userId+entity+recordId], createdAt, updatedAt",
    });
  }
}

let _db: RemiBloomDB | null = null;
let _dbInitAttempted = false;

function initDb(): RemiBloomDB {
  if (!_db && !_dbInitAttempted) {
    _dbInitAttempted = true;
    try {
      _db = new RemiBloomDB();
    } catch {
      // Running in an environment without IndexedDB (SSR, Node.js) — db stays null
    }
  }
  return _db!;
}

// Proxy that lazily initializes Dexie only when a table property is accessed.
// This makes the module safe to import during SSR/prerendering.
export const db = new Proxy<RemiBloomDB>({} as RemiBloomDB, {
  get(_target, prop, _receiver) {
    const instance = initDb();
    if (!instance) {
      // Return a no-op proxy when Dexie isn't available (SSR)
      return new Proxy(() => {}, {
        get(nopTarget, _nopProp) {
          return nopTarget;
        },
        apply() {
          return Promise.resolve([]);
        },
      });
    }
    return (instance as any)[prop];
  },
});

let _syncReplayPromise: Promise<SyncReplayResult> | null = null;

export interface SyncReplayResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

function queueReplay(userId: string) {
  if (!isBrowserOnline()) return;
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    void replaySyncQueue(userId);
  }, 0);
}

function settingUserId(key: string): string | null {
  const [userId] = key.split(":");
  return userId || null;
}

function settingRecordId(key: string): string {
  const [, ...rest] = key.split(":");
  return rest.length > 0 ? rest.join(":") : key;
}

export async function enqueueSyncOperation(
  userId: string,
  entity: SyncEntity,
  action: SyncAction,
  data: any,
  recordId = data?.id ?? data?.key
): Promise<void> {
  if (!userId || !recordId) return;

  const now = new Date().toISOString();
  const existing = await db.syncQueue
    .where("[userId+entity+recordId]")
    .equals([userId, entity, String(recordId)])
    .first();

  if (existing) {
    if (existing.action === "create" && action === "delete") {
      await db.syncQueue.delete(existing.id);
      return;
    }

    await db.syncQueue.put({
      ...existing,
      action: existing.action === "create" ? "create" : action,
      data,
      updatedAt: now,
    });
    return;
  }

  await db.syncQueue.add({
    id: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    userId,
    entity,
    action,
    recordId: String(recordId),
    data,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function replaySyncQueue(userId?: string): Promise<SyncReplayResult> {
  if (_syncReplayPromise) return _syncReplayPromise;

  _syncReplayPromise = (async () => {
    if (!isBrowserOnline()) {
      return { attempted: 0, succeeded: 0, failed: 0 };
    }

    const operations = userId
      ? await db.syncQueue.where("userId").equals(userId).sortBy("createdAt")
      : await db.syncQueue.orderBy("createdAt").toArray();

    if (operations.length === 0) {
      return { attempted: 0, succeeded: 0, failed: 0 };
    }

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed with ${response.status}`);
      }

      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];
      const succeededIds = new Set(
        results
          .filter((result: any) => result?.success && result?.operationId)
          .map((result: any) => result.operationId)
      );

      const failedIds = new Set(
        results
          .filter((result: any) => !result?.success && result?.operationId)
          .map((result: any) => result.operationId)
      );

      if (process.env.NODE_ENV !== "production") {
        for (const result of results) {
          if (!result?.success) {
            const operation = operations.find(
              (item) => item.operationId === result?.operationId
            );
            console.warn("Sync operation failed", {
              entity: operation?.entity,
              action: operation?.action,
              recordId: operation?.recordId,
              error: result?.error,
            });
          }
        }
      }

      await db.transaction("rw", db.syncQueue, async () => {
        for (const operation of operations) {
          if (succeededIds.has(operation.operationId)) {
            await db.syncQueue.delete(operation.id);
          } else if (failedIds.has(operation.operationId)) {
            await db.syncQueue.update(operation.id, {
              attempts: operation.attempts + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      });

      return {
        attempted: operations.length,
        succeeded: succeededIds.size,
        failed: operations.length - succeededIds.size,
      };
    } catch {
      await db.transaction("rw", db.syncQueue, async () => {
        for (const operation of operations) {
          await db.syncQueue.update(operation.id, {
            attempts: operation.attempts + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      });
      return { attempted: operations.length, succeeded: 0, failed: operations.length };
    }
  })();

  try {
    return await _syncReplayPromise;
  } finally {
    _syncReplayPromise = null;
  }
}

async function enqueueAndReplay(
  userId: string,
  entity: SyncEntity,
  action: SyncAction,
  data: any,
  recordId?: string
) {
  await enqueueSyncOperation(userId, entity, action, data, recordId);
  queueReplay(userId);
}

export async function seedMockData(
  plants: Omit<Plant, "userId">[],
  locations: Omit<PlantLocation, "userId">[],
  tags: Omit<Tag, "userId">[],
  userId?: string
) {
  const plantCount = await db.plants.count();
  if (plantCount === 0 && plants.length > 0) {
    const plantsWithUser = plants.map((p) => ({ ...p, userId: userId ?? "" }));
    await db.plants.bulkAdd(plantsWithUser);
  }
  const locationCount = await db.plantLocations.count();
  if (locationCount === 0 && locations.length > 0) {
    const locationsWithUser = locations.map((l) => ({ ...l, userId: userId ?? "" }));
    await db.plantLocations.bulkAdd(locationsWithUser);
  }
  const tagCount = await db.tags.count();
  if (tagCount === 0 && tags.length > 0) {
    const tagsWithUser = tags.map((t) => ({ ...t, userId: userId ?? "" }));
    await db.tags.bulkAdd(tagsWithUser);
  }
}

/**
 * Seed default tags for a specific user if they have none.
 */
export async function seedDefaultTagsForUser(
  tags: Omit<Tag, "userId">[],
  userId: string
) {
  const existingTags = await db.tags.where("userId").equals(userId).toArray();
  if (existingTags.length === 0 && tags.length > 0) {
    const tagsWithUser = tags.map((t) => ({ ...t, userId }));
    await db.tags.bulkAdd(tagsWithUser);
  }
}

/**
 * Seed default locations for a specific user if they have none.
 */
export async function seedDefaultLocationsForUser(
  locations: Omit<PlantLocation, "userId">[],
  userId: string
) {
  const existingLocations = await db.plantLocations.where("userId").equals(userId).toArray();
  if (existingLocations.length === 0 && locations.length > 0) {
    const locationsWithUser = locations.map((l) => ({ ...l, userId }));
    await db.plantLocations.bulkAdd(locationsWithUser);
  }
}

export async function seedCareEvents(events: (Omit<CareEvent, "userId">)[], userId?: string) {
  const count = await db.careEvents.count();
  if (count === 0 && events.length > 0) {
    const eventsWithUser = events.map((e) => ({ ...e, userId: userId ?? "" }));
    await db.careEvents.bulkAdd(eventsWithUser);
  }
}

export async function seedInventory(items: Omit<InventoryItem, "userId">[], userId?: string) {
  const count = await db.inventoryItems.count();
  if (count === 0 && items.length > 0) {
    const itemsWithUser = items.map((i) => ({ ...i, userId: userId ?? "" }));
    await db.inventoryItems.bulkAdd(itemsWithUser);
  }
}

// Plant CRUD
export async function addPlant(plant: Plant) {
  const result = await db.plants.add(plant);
  await enqueueAndReplay(plant.userId, "plant", "create", plant, plant.id);
  return result;
}

export async function updatePlant(plant: Plant) {
  const result = await db.plants.put(plant);
  await enqueueAndReplay(plant.userId, "plant", "update", plant, plant.id);
  return result;
}

export async function deletePlant(id: string) {
  const plant = await db.plants.get(id);
  await db.plants.delete(id);
  await db.careEvents.where("plantId").equals(id).delete();
  await db.journalEntries.where("plantId").equals(id).delete();
  await db.progressEntries.where("plantId").equals(id).delete();
  await db.reminders.where("plantId").equals(id).delete();
  if (plant?.userId) {
    await enqueueAndReplay(plant.userId, "plant", "delete", { id }, id);
  }
}

export async function getAllPlants(): Promise<Plant[]> {
  return db.plants.toArray();
}

// Care Events
export async function addCareEvent(event: CareEvent) {
  const result = await db.careEvents.add(event);
  await enqueueAndReplay(event.userId, "careEvent", "create", event, event.id);
  return result;
}

export async function getCareEventsForPlant(
  plantId: string
): Promise<CareEvent[]> {
  return db.careEvents
    .where("plantId")
    .equals(plantId)
    .reverse()
    .toArray();
}

export async function getAllCareEvents(): Promise<CareEvent[]> {
  return db.careEvents.orderBy("date").reverse().toArray();
}

// Locations
export async function addLocation(location: PlantLocation) {
  const result = await db.plantLocations.add(location);
  await enqueueAndReplay(location.userId, "location", "create", location, location.id);
  return result;
}

export async function updateLocation(location: PlantLocation) {
  const result = await db.plantLocations.put(location);
  await enqueueAndReplay(location.userId, "location", "update", location, location.id);
  return result;
}

export async function deleteLocation(id: string) {
  const location = await db.plantLocations.get(id);
  const result = await db.plantLocations.delete(id);
  if (location?.userId) {
    await enqueueAndReplay(location.userId, "location", "delete", { id }, id);
  }
  return result;
}

export async function getAllLocations(): Promise<PlantLocation[]> {
  return db.plantLocations.toArray();
}

// Tags
export async function addTag(tag: Tag) {
  const result = await db.tags.add(tag);
  await enqueueAndReplay(tag.userId, "tag", "create", tag, tag.id);
  return result;
}

export async function deleteTag(id: string) {
  const tag = await db.tags.get(id);
  const result = await db.tags.delete(id);
  if (tag?.userId) {
    await enqueueAndReplay(tag.userId, "tag", "delete", { id }, id);
  }
  return result;
}

export async function getAllTags(userId?: string): Promise<Tag[]> {
  if (userId) {
    return db.tags.where("userId").equals(userId).toArray();
  }
  return db.tags.toArray();
}

// Inventory
export async function addInventoryItem(item: InventoryItem) {
  const result = await db.inventoryItems.add(item);
  await enqueueAndReplay(item.userId, "inventoryItem", "create", item, item.id);
  return result;
}

export async function updateInventoryItem(item: InventoryItem) {
  const result = await db.inventoryItems.put(item);
  await enqueueAndReplay(item.userId, "inventoryItem", "update", item, item.id);
  return result;
}

export async function deleteInventoryItem(id: string) {
  const item = await db.inventoryItems.get(id);
  const result = await db.inventoryItems.delete(id);
  if (item?.userId) {
    await enqueueAndReplay(item.userId, "inventoryItem", "delete", { id }, id);
  }
  return result;
}

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  return db.inventoryItems.toArray();
}

// Garden
export async function saveGardenCells(cells: GardenCell[], explicitUserId?: string) {
  const userId =
    explicitUserId ??
    cells[0]?.userId ??
    (await db.gardenCells.toArray()).find((cell) => cell.userId)?.userId;
  if (userId) {
    await db.gardenCells.where("userId").equals(userId).delete();
  } else {
    await db.gardenCells.clear();
  }
  await db.gardenCells.bulkAdd(cells);
  if (userId) {
    await enqueueAndReplay(userId, "gardenCells", "replace", { cells }, "all");
  }
}

export async function getGardenCells(): Promise<GardenCell[]> {
  return db.gardenCells.toArray();
}

// Settings
export async function getSetting(key: string): Promise<string | undefined> {
  const entry = await db.settings.get(key);
  return entry?.value;
}

export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value });
  const userId = settingUserId(key);
  if (userId && key.includes(":")) {
    const recordId = settingRecordId(key);
    await enqueueAndReplay(userId, "setting", "update", { key: recordId, value }, recordId);
  }
}

// Journal Entry functions
export async function addJournalEntry(entry: JournalEntry) {
  const result = await db.journalEntries.add(entry);
  await enqueueAndReplay(entry.userId, "journalEntry", "create", entry, entry.id);
  return result;
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  return db.journalEntries.orderBy("date").reverse().toArray();
}

export async function updateJournalEntry(entry: JournalEntry) {
  const result = await db.journalEntries.put(entry);
  await enqueueAndReplay(entry.userId, "journalEntry", "update", entry, entry.id);
  return result;
}

export async function deleteJournalEntry(id: string) {
  const entry = await db.journalEntries.get(id);
  const result = await db.journalEntries.delete(id);
  if (entry?.userId) {
    await enqueueAndReplay(entry.userId, "journalEntry", "delete", { id }, id);
  }
  return result;
}

// --- Reminders ---
export async function addReminder(reminder: Reminder) {
  const result = await db.reminders.add(reminder);
  await enqueueAndReplay(reminder.userId, "reminder", "create", reminder, reminder.id);
  return result;
}

export async function updateReminder(reminder: Reminder) {
  const result = await db.reminders.put(reminder);
  await enqueueAndReplay(reminder.userId, "reminder", "update", reminder, reminder.id);
  return result;
}

export async function deleteReminder(id: string) {
  const reminder = await db.reminders.get(id);
  const result = await db.reminders.delete(id);
  if (reminder?.userId) {
    await enqueueAndReplay(reminder.userId, "reminder", "delete", { id }, id);
  }
  return result;
}

export async function getAllReminders(): Promise<Reminder[]> {
  return db.reminders.orderBy("date").toArray();
}

export async function getRemindersForDate(date: string): Promise<Reminder[]> {
  return db.reminders.where("date").equals(date).toArray();
}

// --- Todos ---
export async function addTodo(todo: Todo) {
  const result = await db.todos.add(todo);
  await enqueueAndReplay(todo.userId, "todo", "create", todo, todo.id);
  return result;
}

export async function updateTodo(todo: Todo) {
  const result = await db.todos.put(todo);
  await enqueueAndReplay(todo.userId, "todo", "update", todo, todo.id);
  return result;
}

export async function deleteTodo(id: string) {
  const todo = await db.todos.get(id);
  const result = await db.todos.delete(id);
  if (todo?.userId) {
    await enqueueAndReplay(todo.userId, "todo", "delete", { id }, id);
  }
  return result;
}

export async function getAllTodos(): Promise<Todo[]> {
  return db.todos.orderBy("date").toArray();
}

// --- Progress Entries ---
export async function addProgressEntry(entry: ProgressEntry) {
  const result = await db.progressEntries.add(entry);
  await enqueueAndReplay(entry.userId, "progressEntry", "create", entry, entry.id);
  return result;
}

export async function updateProgressEntry(entry: ProgressEntry) {
  const result = await db.progressEntries.put(entry);
  await enqueueAndReplay(entry.userId, "progressEntry", "update", entry, entry.id);
  return result;
}

export async function deleteProgressEntry(id: string) {
  const entry = await db.progressEntries.get(id);
  const result = await db.progressEntries.delete(id);
  if (entry?.userId) {
    await enqueueAndReplay(entry.userId, "progressEntry", "delete", { id }, id);
  }
  return result;
}

export async function getProgressEntriesForPlant(
  plantId: string
): Promise<ProgressEntry[]> {
  return db.progressEntries
    .where("plantId")
    .equals(plantId)
    .reverse()
    .toArray();
}

export async function getAllProgressEntries(): Promise<ProgressEntry[]> {
  return db.progressEntries.orderBy("date").reverse().toArray();
}

// --- Shared Gardens ---
export async function addSharedGarden(garden: SharedGarden) {
  const result = await db.sharedGardens.add(garden);
  await enqueueAndReplay(garden.ownerId, "sharedGarden", "create", garden, garden.id);
  return result;
}

export async function updateSharedGarden(garden: SharedGarden) {
  const result = await db.sharedGardens.put(garden);
  await enqueueAndReplay(garden.ownerId, "sharedGarden", "update", garden, garden.id);
  return result;
}

export async function deleteSharedGarden(id: string) {
  const garden = await db.sharedGardens.get(id);
  const result = await db.sharedGardens.delete(id);
  if (garden?.ownerId) {
    await enqueueAndReplay(garden.ownerId, "sharedGarden", "delete", { id }, id);
  }
  return result;
}

export async function getSharedGardens(): Promise<SharedGarden[]> {
  return db.sharedGardens.toArray();
}

export async function getSharedGardenByCode(
  code: string
): Promise<SharedGarden | undefined> {
  return db.sharedGardens.where("code").equals(code).first();
}

// --- Image Uploads ---

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/tiff",
];

export function isValidImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export async function uploadImage(
  file: File
): Promise<UploadedImage> {
  if (!isValidImageType(file.type)) {
    throw new Error(
      `Unsupported image format "${file.type}". Allowed: JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF`
    );
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image too large. Maximum size is 10MB.");
  }

  const compressedBlob = await compressImage(file);
  const imageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const image: UploadedImage = {
    id: imageId,
    data: compressedBlob,
    mimeType: "image/webp",
    name: file.name.replace(/\.[^.]+$/, "") + ".webp",
    userId: "",
    createdAt: new Date().toISOString(),
  };
  await db.uploadedImages.put(image);
  return image;
}

export async function getImageUrl(imageId: string): Promise<string | null> {
  const image = await db.uploadedImages.get(imageId);
  if (!image) return null;
  return URL.createObjectURL(image.data);
}

export async function deleteUploadedImage(imageId: string): Promise<void> {
  await db.uploadedImages.delete(imageId);
}

// --- Action Engine CRUD ---

export async function addActionItem(item: ActionItem) {
  if (!item.userId) throw new Error("Cannot save action: user ID is missing");
  const result = await db.actionItems.add(item);
  await enqueueAndReplay(item.userId, "actionItem", "create", item, item.id);
  return result;
}

export async function updateActionItem(item: ActionItem) {
  if (!item.userId) throw new Error("Cannot save action: user ID is missing");
  const result = await db.actionItems.put(item);
  await enqueueAndReplay(item.userId, "actionItem", "update", item, item.id);
  return result;
}

export async function deleteActionItem(id: string) {
  const item = await db.actionItems.get(id);
  const result = await db.actionItems.delete(id);
  if (item?.userId) {
    await enqueueAndReplay(item.userId, "actionItem", "delete", { id }, id);
  }
  return result;
}

export async function getAllActionItems(): Promise<ActionItem[]> {
  return db.actionItems.orderBy("date").toArray();
}

export async function getActionItemsForDate(
  date: string
): Promise<ActionItem[]> {
  return db.actionItems.where("date").equals(date).toArray();
}

export async function getActionItemsByPlant(
  plantId: string
): Promise<ActionItem[]> {
  return db.actionItems.where("plantId").equals(plantId).toArray();
}

// --- Users CRUD ---

export async function addUser(user: User) {
  return db.users.add(user);
}

export async function updateUser(user: User) {
  return db.users.put(user);
}

export async function deleteUser(id: string) {
  await db.users.delete(id);
}

export async function getAllUsers(): Promise<User[]> {
  return db.users.toArray();
}

export async function getUser(id: string): Promise<User | undefined> {
  return db.users.get(id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return db.users.where("username").equals(username.toLowerCase()).first();
}

export async function seedDefaultAdmin() {
  console.warn(
    "seedDefaultAdmin is disabled. Users are canonical in Postgres via NextAuth; use /api/seed with REMI_BLOOM_SEED_SECRET for local bootstrap."
  );
}

// --- Audit Log CRUD ---

export async function addAuditLog(
  userId: string,
  username: string,
  action: string,
  details: string
): Promise<string> {
  const id = crypto.randomUUID();
  await db.auditLogs.add({
    id,
    userId,
    username,
    action,
    details,
    timestamp: new Date().toISOString(),
  });
  return id;
}

export async function getAuditLogs(limit = 50): Promise<AuditLog[]> {
  return db.auditLogs
    .orderBy("timestamp")
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getAuditLogsForUser(userId: string, limit = 20): Promise<AuditLog[]> {
  return db.auditLogs
    .where("userId")
    .equals(userId)
    .reverse()
    .limit(limit)
    .toArray();
}

// --- Species Cache CRUD ---

export async function getSpeciesCache(
  scientificName: string
): Promise<SpeciesCacheEntry | undefined> {
  return db.speciesCache.get(scientificName.toLowerCase().trim());
}

export async function setSpeciesCache(
  entry: SpeciesCacheEntry
): Promise<void> {
  await db.speciesCache.put({
    ...entry,
    scientificName: entry.scientificName.toLowerCase().trim(),
  });
}

// ──────────────────────────────────────────────
// Per-user filtered queries
// ──────────────────────────────────────────────

export async function getPlantsForUser(userId: string): Promise<Plant[]> {
  return db.plants.where("userId").equals(userId).toArray();
}

export async function getLocationsForUser(userId: string): Promise<PlantLocation[]> {
  return db.plantLocations.where("userId").equals(userId).toArray();
}

export async function getTagsForUser(userId: string): Promise<Tag[]> {
  return db.tags.where("userId").equals(userId).toArray();
}

export async function getInventoryForUser(userId: string): Promise<InventoryItem[]> {
  return db.inventoryItems.where("userId").equals(userId).toArray();
}

export async function getCareEventsForUser(userId: string): Promise<CareEvent[]> {
  return db.careEvents.where("userId").equals(userId).reverse().toArray();
}

export async function getJournalEntriesForUser(userId: string): Promise<JournalEntry[]> {
  return db.journalEntries.where("userId").equals(userId).toArray();
}

export async function getRemindersForUser(userId: string): Promise<Reminder[]> {
  return db.reminders.where("userId").equals(userId).toArray();
}

export async function getTodosForUser(userId: string): Promise<Todo[]> {
  return db.todos.where("userId").equals(userId).toArray();
}

export async function getProgressEntriesForUser(userId: string): Promise<ProgressEntry[]> {
  return db.progressEntries.where("userId").equals(userId).toArray();
}

export async function getActionItemsForUser(userId: string): Promise<ActionItem[]> {
  return db.actionItems.where("userId").equals(userId).toArray();
}

export async function getGardenCellsForUser(userId: string): Promise<GardenCell[]> {
  return db.gardenCells.where("userId").equals(userId).toArray();
}

export async function getSharedGardensForUser(userId: string): Promise<SharedGarden[]> {
  return db.sharedGardens.filter((g) => g.ownerId === userId || g.members.some((m) => m.id === userId)).toArray();
}

/**
 * Get a user-specific setting (key prefixed with userId for isolation).
 */
export async function getUserSetting(userId: string, key: string): Promise<string | undefined> {
  const localValue = await getSetting(`${userId}:${key}`);
  if (localValue !== undefined || typeof window === "undefined") {
    return localValue;
  }

  try {
    const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const payload = await response.json();
    if (typeof payload.value === "string") {
      await db.settings.put({ key: `${userId}:${key}`, value: payload.value });
      return payload.value;
    }
  } catch {
    // IndexedDB remains the offline source of truth when the API is unavailable.
  }

  return undefined;
}

export async function setUserSetting(userId: string, key: string, value: string): Promise<void> {
  return setSetting(`${userId}:${key}`, value);
}
