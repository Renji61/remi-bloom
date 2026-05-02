import {
  seedMockData,
  seedCareEvents,
  seedInventory,
  seedDefaultTagsForUser,
  seedDefaultLocationsForUser,
  getAllTags,
  getSetting,
  getPlantsForUser,
  getLocationsForUser,
  getTagsForUser,
  getInventoryForUser,
  getProgressEntriesForUser,
  getActionItemsForUser,
  getJournalEntriesForUser,
  getGardenCellsForUser,
  getSharedGardensForUser,
  getCareEventsForUser,
  replaySyncQueue,
  type Plant,
  type CareEvent,
  type PlantLocation,
  type Tag,
  type InventoryItem,
  type JournalEntry,
  type GardenCell,
  type ProgressEntry,
  type SharedGarden,
  type ActionItem,
  type Reminder,
  type Todo,
} from "@/lib/db";
import {
  mockPlants,
  mockLocations,
  mockTags,
  mockCareEvents,
  mockInventoryItems,
} from "@/data/plants";
import { useAppStore } from "@/stores/app-store";
import { syncAll, type SyncPayload } from "@/lib/api-client";

/**
 * Whether the API backend is available.
 * Checks by trying to hit the sync endpoint.
 */
let _apiAvailable: { value: boolean; checkedAt: number } | null = null;
const API_AVAILABLE_TTL_MS = 5000;

async function isApiAvailable(): Promise<boolean> {
  if (
    _apiAvailable &&
    Date.now() - _apiAvailable.checkedAt < API_AVAILABLE_TTL_MS
  ) {
    return _apiAvailable.value;
  }
  try {
    const res = await fetch("/api/ping", { method: "HEAD" });
    _apiAvailable = { value: res.ok, checkedAt: Date.now() };
  } catch {
    _apiAvailable = { value: false, checkedAt: Date.now() };
  }
  return _apiAvailable.value;
}

export function markApiAvailable(value: boolean) {
  _apiAvailable = { value, checkedAt: Date.now() };
}

/**
 * Hydrate the Zustand store from a sync payload (from API or fallback).
 */
function hydrateStore(payload: SyncPayload) {
  const store = useAppStore.getState();
  store.setPlants(payload.plants as Plant[]);
  store.setCareEvents(payload.careEvents as CareEvent[]);
  store.setLocations(payload.locations as PlantLocation[]);
  store.setTags(payload.tags as Tag[]);
  store.setInventoryItems(payload.inventory as InventoryItem[]);
  store.setJournalEntries(payload.journals as JournalEntry[]);
  store.setReminders([] as Reminder[]);
  store.setTodos([] as Todo[]);
  store.setProgressEntries(payload.progress as ProgressEntry[]);
  store.setActionItems(payload.actionItems as ActionItem[]);
  store.setSharedGardens(payload.sharedGardens as SharedGarden[]);
  if (payload.gardenCells.length > 0) {
    store.setGardenCells(payload.gardenCells as GardenCell[]);
  }

  // Notification settings
  const s = payload.settings;
  if (s.themeMode && ["dark", "light", "system"].includes(s.themeMode)) {
    store.setThemeMode(s.themeMode as any);
  }
  if (s.themeColor && ["emerald", "terracotta", "sky", "lavender", "rose"].includes(s.themeColor)) {
    store.setThemeColor(s.themeColor as any);
  }
  if (s.currencyCode) {
    store.setCurrencyCode(s.currencyCode);
  }
  if (s.currencySymbol) {
    store.setCurrencySymbol(s.currencySymbol);
  }
  if (s.faviconUrl !== undefined) {
    store.setFaviconUrl(s.faviconUrl);
  }
  if (s.greenhouseName) {
    store.setGreenhouseName(s.greenhouseName);
  }
  store.setNotificationEngine((s.notificationEngine as any) || "disabled");
  store.setNotificationEngineUrl(s.notificationUrl ?? "");
  store.setNotificationEngineToken(s.notificationToken ?? "");
  store.setUseWeatherAlerts(s.useWeatherAlerts === "true");
  store.setUseCareAlerts(s.useCareAlerts === "true");
}

// ──────────────────────────────────────────────
// Main load function
// ──────────────────────────────────────────────

export async function loadUserData(userId: string) {
  const store = useAppStore.getState();

  // Try API first
  if (await isApiAvailable()) {
    try {
      await replaySyncQueue(userId);
      const payload = await syncAll();
      hydrateStore(payload);

      // Also write to IndexedDB as offline cache
      await cacheToIndexedDB(userId, payload);

      return;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("API data load failed; falling back to IndexedDB", error);
    }
    // Fall through to IndexedDB fallback
    }
  }

  // Fallback: load from IndexedDB (offline mode)
  await loadFromIndexedDB(userId, store);
}

// ──────────────────────────────────────────────
// Fallback: Load from IndexedDB
// ──────────────────────────────────────────────

export async function loadFromIndexedDB(userId: string, store: any) {
  // Seed mock data if user has no data yet
  const existingPlants = await getPlantsForUser(userId);
  if (existingPlants.length === 0) {
    await seedMockData(mockPlants, mockLocations, mockTags, userId);
    await seedCareEvents(mockCareEvents, userId);
    await seedInventory(mockInventoryItems, userId);
  } else {
    // Seed default tags/locations even if user already has plants
    await seedDefaultTagsForUser(mockTags, userId);
    await seedDefaultLocationsForUser(mockLocations, userId);
  }

  const [
    plants,
    locations,
    tags,
    inventory,
    progress,
    actionItems,
    journals,
    gardenCells,
    sharedGardens,
    careEvents,
  ] = await Promise.all([
    getPlantsForUser(userId),
    getLocationsForUser(userId),
    getTagsForUser(userId),
    getInventoryForUser(userId),
    getProgressEntriesForUser(userId),
    getActionItemsForUser(userId),
    getJournalEntriesForUser(userId),
    getGardenCellsForUser(userId),
    getSharedGardensForUser(userId),
    getCareEventsForUser(userId),
  ]);

  store.setPlants(plants);
  store.setLocations(locations);
  store.setTags(tags);
  store.setInventoryItems(inventory);
  store.setReminders([]);
  store.setTodos([]);
  store.setProgressEntries(progress);
  store.setActionItems(actionItems);
  store.setJournalEntries(journals);
  store.setSharedGardens(sharedGardens);
  store.setCareEvents(careEvents);
  if (gardenCells.length > 0) store.setGardenCells(gardenCells);

  // Load user-scoped settings from IndexedDB
  const prefix = `${userId}:`;
  const [
    engineVal,
    urlVal,
    tokenVal,
    weatherVal,
    careVal,
    themeMode,
    themeColor,
    currencyCode,
    currencySymbol,
    faviconUrl,
    greenhouseName,
  ] = await Promise.all([
    getSetting(`${prefix}notificationEngine`),
    getSetting(`${prefix}notificationUrl`),
    getSetting(`${prefix}notificationToken`),
    getSetting(`${prefix}useWeatherAlerts`),
    getSetting(`${prefix}useCareAlerts`),
    getSetting(`${prefix}themeMode`),
    getSetting(`${prefix}themeColor`),
    getSetting(`${prefix}currencyCode`),
    getSetting(`${prefix}currencySymbol`),
    getSetting(`${prefix}faviconUrl`),
    getSetting(`${prefix}greenhouseName`),
  ]);

  if (themeMode && ["dark", "light", "system"].includes(themeMode)) {
    store.setThemeMode(themeMode as any);
  }
  if (themeColor && ["emerald", "terracotta", "sky", "lavender", "rose"].includes(themeColor)) {
    store.setThemeColor(themeColor as any);
  }
  if (currencyCode) store.setCurrencyCode(currencyCode);
  if (currencySymbol) store.setCurrencySymbol(currencySymbol);
  if (faviconUrl !== undefined) store.setFaviconUrl(faviconUrl);
  if (greenhouseName) store.setGreenhouseName(greenhouseName);
  store.setNotificationEngine((engineVal as any) || "disabled");
  store.setNotificationEngineUrl(urlVal ?? "");
  store.setNotificationEngineToken(tokenVal ?? "");
  store.setUseWeatherAlerts(weatherVal === "true");
  store.setUseCareAlerts(careVal === "true");
}

// ──────────────────────────────────────────────
// Cache API data into IndexedDB for offline use
// ──────────────────────────────────────────────

async function cacheToIndexedDB(userId: string, payload: SyncPayload) {
  try {
    const { db } = await import("@/lib/db");

    // Write all data to IndexedDB as offline cache
    await db.transaction(
      "rw",
      [
        db.plants,
        db.careEvents,
        db.plantLocations,
        db.tags,
        db.inventoryItems,
        db.journalEntries,
        db.gardenCells,
        db.progressEntries,
        db.sharedGardens,
        db.actionItems,
        db.settings,
      ],
      async () => {
        // Clear existing data for this user
        await db.plants.where("userId").equals(userId).delete();
        await db.careEvents.where("userId").equals(userId).delete();
        await db.plantLocations.where("userId").equals(userId).delete();
        await db.tags.where("userId").equals(userId).delete();
        await db.inventoryItems.where("userId").equals(userId).delete();
        await db.journalEntries.where("userId").equals(userId).delete();
        await db.gardenCells.where("userId").equals(userId).delete();
        await db.progressEntries.where("userId").equals(userId).delete();
        await db.sharedGardens
          .filter(
            (g: SharedGarden) =>
              g.ownerId === userId ||
              g.members.some((m) => m.id === userId)
          )
          .delete();
        await db.actionItems.where("userId").equals(userId).delete();

        // Bulk insert new data
        if (payload.plants.length > 0) await db.plants.bulkAdd(payload.plants);
        if (payload.careEvents.length > 0)
          await db.careEvents.bulkAdd(payload.careEvents);
        if (payload.locations.length > 0)
          await db.plantLocations.bulkAdd(payload.locations);
        if (payload.tags.length > 0) await db.tags.bulkAdd(payload.tags);
        if (payload.inventory.length > 0)
          await db.inventoryItems.bulkAdd(payload.inventory);
        if (payload.journals.length > 0)
          await db.journalEntries.bulkAdd(payload.journals);
        if (payload.gardenCells.length > 0)
          await db.gardenCells.bulkAdd(payload.gardenCells);
        if (payload.progress.length > 0)
          await db.progressEntries.bulkAdd(payload.progress);
        if (payload.sharedGardens.length > 0)
          await db.sharedGardens.bulkAdd(payload.sharedGardens);
        if (payload.actionItems.length > 0)
          await db.actionItems.bulkAdd(payload.actionItems);

        // Cache user settings
        for (const [key, value] of Object.entries(payload.settings)) {
          const dbKey = `${userId}:${key}`;
          const existing = await db.settings.get(dbKey);
          if (existing) {
            await db.settings.put({ key: dbKey, value });
          } else {
            await db.settings.add({ key: dbKey, value });
          }
        }
      }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to cache API payload into IndexedDB", error);
    }
  }
}
