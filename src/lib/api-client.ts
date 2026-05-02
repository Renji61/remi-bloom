/**
 * API Client — mirrors the function signatures from @/lib/db.ts but hits
 * the REST API instead of IndexedDB directly.
 *
 * Components import from here instead of db.ts. The db.ts IndexedDB layer
 * is kept as a local cache / offline fallback.
 */

import type {
  Plant,
  CareEvent,
  PlantLocation,
  Tag,
  InventoryItem,
  JournalEntry,
  GardenCell,
  Reminder,
  Todo,
  ProgressEntry,
  SharedGarden,
  ActionItem,
  UploadedImage,
} from "@/lib/db";
import * as localDb from "@/lib/db";

// ──────────────────────────────────────────────
// API helpers
// ──────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ──────────────────────────────────────────────
// Sync — fetch ALL user data at once (on login)
// ──────────────────────────────────────────────

export interface SyncPayload {
  plants: any[];
  careEvents: any[];
  locations: any[];
  tags: any[];
  inventory: any[];
  journals: any[];
  gardenCells: any[];
  progress: any[];
  sharedGardens: any[];
  actionItems: any[];
  auditLogs: any[];
  settings: Record<string, string>;
}

export async function syncAll(): Promise<SyncPayload> {
  return apiFetch<SyncPayload>("/api/sync");
}

export async function syncOperations(operations: any[]): Promise<any> {
  return apiFetch("/api/sync", {
    method: "POST",
    body: JSON.stringify({ operations }),
  });
}

// ──────────────────────────────────────────────
// Plants
// ──────────────────────────────────────────────

export async function addPlant(plant: Plant): Promise<Plant> {
  await localDb.addPlant(plant);
  return plant;
}

export async function updatePlant(plant: Plant): Promise<Plant> {
  await localDb.updatePlant(plant);
  return plant;
}

export async function deletePlant(id: string): Promise<void> {
  await localDb.deletePlant(id);
}

export async function getAllPlants(): Promise<Plant[]> {
  return apiFetch<Plant[]>("/api/plants");
}

// ──────────────────────────────────────────────
// Care Events
// ──────────────────────────────────────────────

export async function addCareEvent(event: CareEvent): Promise<CareEvent> {
  await localDb.addCareEvent(event);
  return event;
}

export async function getCareEventsForPlant(
  plantId: string
): Promise<CareEvent[]> {
  return apiFetch<CareEvent[]>(`/api/care-events?plantId=${plantId}`);
}

export async function getAllCareEvents(): Promise<CareEvent[]> {
  return apiFetch<CareEvent[]>("/api/care-events");
}

// ──────────────────────────────────────────────
// Locations
// ──────────────────────────────────────────────

export async function addLocation(
  location: PlantLocation
): Promise<PlantLocation> {
  await localDb.addLocation(location);
  return location;
}

export async function updateLocation(
  location: PlantLocation
): Promise<PlantLocation> {
  await localDb.updateLocation(location);
  return location;
}

export async function deleteLocation(id: string): Promise<void> {
  await localDb.deleteLocation(id);
}

export async function getAllLocations(): Promise<PlantLocation[]> {
  return apiFetch<PlantLocation[]>("/api/locations");
}

// ──────────────────────────────────────────────
// Tags
// ──────────────────────────────────────────────

export async function addTag(tag: Tag): Promise<Tag> {
  await localDb.addTag(tag);
  return tag;
}

export async function deleteTag(id: string): Promise<void> {
  await localDb.deleteTag(id);
}

export async function getAllTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>("/api/tags");
}

// ──────────────────────────────────────────────
// Inventory
// ──────────────────────────────────────────────

export async function addInventoryItem(
  item: InventoryItem
): Promise<InventoryItem> {
  await localDb.addInventoryItem(item);
  return item;
}

export async function updateInventoryItem(
  item: InventoryItem
): Promise<InventoryItem> {
  await localDb.updateInventoryItem(item);
  return item;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await localDb.deleteInventoryItem(id);
}

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  return apiFetch<InventoryItem[]>("/api/inventory");
}

// ──────────────────────────────────────────────
// Garden
// ──────────────────────────────────────────────

export async function saveGardenCells(cells: GardenCell[], userId?: string): Promise<void> {
  await localDb.saveGardenCells(cells, userId);
}

export async function getGardenCells(): Promise<GardenCell[]> {
  return apiFetch<GardenCell[]>("/api/garden");
}

// ──────────────────────────────────────────────
// Journal
// ──────────────────────────────────────────────

export async function addJournalEntry(
  entry: JournalEntry
): Promise<JournalEntry> {
  await localDb.addJournalEntry(entry);
  return entry;
}

export async function updateJournalEntry(
  entry: JournalEntry
): Promise<JournalEntry> {
  await localDb.updateJournalEntry(entry);
  return entry;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await localDb.deleteJournalEntry(id);
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  return apiFetch<JournalEntry[]>("/api/journal");
}

// ──────────────────────────────────────────────
// Reminders (stubs — superseded by actionItems)
// ──────────────────────────────────────────────

export async function addReminder(reminder: Reminder): Promise<Reminder> {
  await localDb.addReminder(reminder);
  return reminder;
}

export async function updateReminder(reminder: Reminder): Promise<Reminder> {
  await localDb.updateReminder(reminder);
  return reminder;
}

export async function deleteReminder(id: string): Promise<void> {
  await localDb.deleteReminder(id);
}

export async function getAllReminders(): Promise<Reminder[]> {
  return localDb.getAllReminders();
}

// ──────────────────────────────────────────────
// Todos (stubs — superseded by actionItems)
// ──────────────────────────────────────────────

export async function addTodo(todo: Todo): Promise<Todo> {
  await localDb.addTodo(todo);
  return todo;
}

export async function updateTodo(todo: Todo): Promise<Todo> {
  await localDb.updateTodo(todo);
  return todo;
}

export async function deleteTodo(id: string): Promise<void> {
  await localDb.deleteTodo(id);
}

export async function getAllTodos(): Promise<Todo[]> {
  return localDb.getAllTodos();
}

// ──────────────────────────────────────────────
// Progress Entries
// ──────────────────────────────────────────────

export async function addProgressEntry(
  entry: ProgressEntry
): Promise<ProgressEntry> {
  await localDb.addProgressEntry(entry);
  return entry;
}

export async function updateProgressEntry(
  entry: ProgressEntry
): Promise<ProgressEntry> {
  await localDb.updateProgressEntry(entry);
  return entry;
}

export async function deleteProgressEntry(id: string): Promise<void> {
  await localDb.deleteProgressEntry(id);
}

export async function getAllProgressEntries(): Promise<ProgressEntry[]> {
  return apiFetch<ProgressEntry[]>("/api/progress");
}

// ──────────────────────────────────────────────
// Action Items
// ──────────────────────────────────────────────

export async function addActionItem(item: ActionItem): Promise<ActionItem> {
  await localDb.addActionItem(item);
  return item;
}

export async function updateActionItem(item: ActionItem): Promise<ActionItem> {
  await localDb.updateActionItem(item);
  return item;
}

export async function deleteActionItem(id: string): Promise<void> {
  await localDb.deleteActionItem(id);
}

export async function getAllActionItems(): Promise<ActionItem[]> {
  return apiFetch<ActionItem[]>("/api/action-items");
}

// ──────────────────────────────────────────────
// Shared Gardens
// ──────────────────────────────────────────────

export async function addSharedGarden(
  garden: SharedGarden
): Promise<SharedGarden> {
  await localDb.addSharedGarden(garden);
  return garden;
}

export async function updateSharedGarden(
  garden: SharedGarden
): Promise<SharedGarden> {
  await localDb.updateSharedGarden(garden);
  return garden;
}

export async function deleteSharedGarden(id: string): Promise<void> {
  await localDb.deleteSharedGarden(id);
}

export async function getSharedGardens(): Promise<SharedGarden[]> {
  return apiFetch<SharedGarden[]>("/api/shared-gardens");
}

// ──────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const res = await apiFetch<{ value: string | null }>(
    `/api/settings?key=${encodeURIComponent(key)}`
  );
  return res.value ?? undefined;
}

export async function setSetting(
  key: string,
  value: string
): Promise<void> {
  await localDb.setSetting(key, value);
}

// ──────────────────────────────────────────────
// Images — these remain purely client-side via IndexedDB
// (Images are stored as Blobs in IndexedDB and not synced to the server yet)
// ──────────────────────────────────────────────

export async function uploadImage(_file: File): Promise<UploadedImage> {
  throw new Error(
    "Image upload via API is not yet implemented. Use IndexedDB directly."
  );
}

export async function getImageUrl(_imageId: string): Promise<string | null> {
  return null;
}

export async function deleteUploadedImage(_imageId: string): Promise<void> {
  // no-op on API side
}
