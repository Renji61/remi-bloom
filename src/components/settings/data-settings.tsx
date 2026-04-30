"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Trash2,
  AlertTriangle,
  Sprout,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/components/ui";
import { db, setUserSetting } from "@/lib/db";
import {
  forceSeedTags,
  forceSeedLocations,
  forceSeedPlants,
} from "@/lib/db";
import { useAppStore } from "@/stores/app-store";
import { loadUserData } from "@/lib/load-user-data";
import {
  getPlantsForUser,
  getLocationsForUser,
  getTagsForUser,
  getInventoryForUser,
  getRemindersForUser,
  getTodosForUser,
  getProgressEntriesForUser,
  getActionItemsForUser,
  getJournalEntriesForUser,
  getGardenCellsForUser,
  getSharedGardensForUser,
  getCareEventsForUser,
  getSetting,
} from "@/lib/db";
import {
  mockTags,
  mockLocations,
  mockPlants,
} from "@/data/plants";

export function DataSettings() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [tab, setTab] = useState<"export" | "import" | "seed">("export");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seeding state
  const [seeding, setSeeding] = useState<string | null>(null); // 'tags' | 'locations' | 'plants' | null

  const setPlants = useAppStore((s) => s.setPlants);
  const setLocations = useAppStore((s) => s.setLocations);
  const setTags = useAppStore((s) => s.setTags);
  const setCareEvents = useAppStore((s) => s.setCareEvents);
  const setJournalEntries = useAppStore((s) => s.setJournalEntries);
  const setInventoryItems = useAppStore((s) => s.setInventoryItems);

  // Clear user data state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setStatus({ type: null, message: "" });
    try {
      const prefix = currentUserId ? `${currentUserId}:` : "";
      const plants = await db.plants.where("userId").equals(currentUserId ?? "").toArray();
      const events = await db.careEvents.where("userId").equals(currentUserId ?? "").toArray();
      const locations = await db.plantLocations.where("userId").equals(currentUserId ?? "").toArray();
      const tags = await db.tags.toArray();
      const inventory = await db.inventoryItems.where("userId").equals(currentUserId ?? "").toArray();
      const journal = await db.journalEntries.where("userId").equals(currentUserId ?? "").toArray();
      const garden = await db.gardenCells.where("userId").equals(currentUserId ?? "").toArray();
      const reminders = await db.reminders.where("userId").equals(currentUserId ?? "").toArray();
      const todos = await db.todos.where("userId").equals(currentUserId ?? "").toArray();
      const progress = await db.progressEntries.where("userId").equals(currentUserId ?? "").toArray();
      const actionItems = await db.actionItems.where("userId").equals(currentUserId ?? "").toArray();
      const uploadedImages = await db.uploadedImages.where("userId").equals(currentUserId ?? "").toArray();
      const userSettings = await db.settings.filter((s) => s.key.startsWith(prefix)).toArray();

      const data = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        summary: {
          plants: plants.length,
          careEvents: events.length,
          locations: locations.length,
          tags: tags.length,
          inventoryItems: inventory.length,
          journalEntries: journal.length,
          gardenCells: garden.length,
          reminders: reminders.length,
          todos: todos.length,
          progressEntries: progress.length,
          actionItems: actionItems.length,
          uploadedImages: uploadedImages.length,
          userSettings: userSettings.length,
        },
        plants,
        careEvents: events,
        locations,
        tags,
        inventoryItems: inventory,
        journalEntries: journal,
        gardenCells: garden,
        reminders,
        todos,
        progressEntries: progress,
        actionItems,
        uploadedImages,
        userSettings,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `remi-bloom-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({
        type: "success",
        message: `Exported ${plants.length} plants, ${events.length} care events, ${inventory.length} inventory items, and more.`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatus({ type: null, message: "" });

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.plants || !data.version) {
        throw new Error("Invalid backup file format");
      }

      // Clear existing data for this user
      await clearCurrentUserData();

      // Assign all imported data to the current user
      const assignUser = (items: any[]) =>
        items?.map((item: any) => ({ ...item, userId: currentUserId ?? item.userId })) ?? [];

      if (data.plants?.length) await db.plants.bulkAdd(assignUser(data.plants));
      if (data.careEvents?.length) await db.careEvents.bulkAdd(assignUser(data.careEvents));
      if (data.locations?.length) await db.plantLocations.bulkAdd(assignUser(data.locations));
      if (data.tags?.length) await db.tags.bulkAdd(data.tags);
      if (data.inventoryItems?.length) await db.inventoryItems.bulkAdd(assignUser(data.inventoryItems));
      if (data.journalEntries?.length) await db.journalEntries.bulkAdd(assignUser(data.journalEntries));
      if (data.gardenCells?.length) await db.gardenCells.bulkAdd(assignUser(data.gardenCells));
      if (data.reminders?.length) await db.reminders.bulkAdd(assignUser(data.reminders));
      if (data.todos?.length) await db.todos.bulkAdd(assignUser(data.todos));
      if (data.progressEntries?.length) await db.progressEntries.bulkAdd(assignUser(data.progressEntries));
      if (data.actionItems?.length) await db.actionItems.bulkAdd(assignUser(data.actionItems));
      if (data.uploadedImages?.length) await db.uploadedImages.bulkAdd(assignUser(data.uploadedImages));
      if (data.userSettings?.length) {
        // Re-prefix settings with current user
        for (const s of data.userSettings) {
          const key = s.key.includes(":")
            ? s.key.split(":").slice(1).join(":")
            : s.key;
          if (currentUserId && key) {
            await setUserSetting(currentUserId, key, s.value);
          }
        }
      }

      // Also push imported data to server API if available
      try {
        await fetch("/api/data", { method: "DELETE" });
        const syncPayload = {
          plants: assignUser(data.plants),
          careEvents: assignUser(data.careEvents),
          locations: assignUser(data.locations),
          tags: data.tags,
          inventory: assignUser(data.inventoryItems),
          journals: assignUser(data.journalEntries),
          gardenCells: assignUser(data.gardenCells),
          reminders: assignUser(data.reminders),
          todos: assignUser(data.todos),
          progress: assignUser(data.progressEntries),
          sharedGardens: assignUser(data.sharedGardens),
          actionItems: assignUser(data.actionItems),
          settings: {},
        };
        await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(syncPayload),
        });
      } catch {
        // Server may not be available; data is in IndexedDB
      }

      // Force load from IndexedDB (skip API to use imported data)
      const { loadFromIndexedDB } = await import("@/lib/load-user-data");
      const store = useAppStore.getState();
      if (currentUserId) {
        await loadFromIndexedDB(currentUserId, store);
      }

      setStatus({
        type: "success",
        message: `Restored ${data.summary?.plants ?? data.plants?.length ?? 0} plants, and more from "${file.name}".`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: `Import failed: ${err instanceof Error ? err.message : "Invalid file"}. Make sure you're importing a valid REMI Bloom backup file.`,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setImporting(false);
    }
  };

  /** Clear all data belonging to the current user, including per-user settings. */
  async function clearCurrentUserData() {
    if (!currentUserId) return;
    const prefix = `${currentUserId}:`;

    await Promise.all([
      db.plants.where("userId").equals(currentUserId).delete(),
      db.careEvents.where("userId").equals(currentUserId).delete(),
      db.plantLocations.where("userId").equals(currentUserId).delete(),
      db.inventoryItems.where("userId").equals(currentUserId).delete(),
      db.journalEntries.where("userId").equals(currentUserId).delete(),
      db.gardenCells.where("userId").equals(currentUserId).delete(),
      db.reminders.where("userId").equals(currentUserId).delete(),
      db.todos.where("userId").equals(currentUserId).delete(),
      db.progressEntries.where("userId").equals(currentUserId).delete(),
      db.actionItems.where("userId").equals(currentUserId).delete(),
      db.uploadedImages.where("userId").equals(currentUserId).delete(),
      db.settings.filter((s) => s.key.startsWith(prefix)).delete(),
    ]);
  }

  // ── Seeding handlers ──

  const handleSeedTags = async () => {
    if (!currentUserId) return;
    setSeeding("tags");
    setStatus({ type: null, message: "" });
    try {
      await forceSeedTags(mockTags, currentUserId);
      const { loadFromIndexedDB } = await import("@/lib/load-user-data");
      const store = useAppStore.getState();
      await loadFromIndexedDB(currentUserId, store);
      setStatus({ type: "success", message: `Seeded ${mockTags.length} default tags.` });
    } catch (err) {
      setStatus({ type: "error", message: `Failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setSeeding(null);
    }
  };

  const handleSeedLocations = async () => {
    if (!currentUserId) return;
    setSeeding("locations");
    setStatus({ type: null, message: "" });
    try {
      await forceSeedLocations(mockLocations, currentUserId);
      const { loadFromIndexedDB } = await import("@/lib/load-user-data");
      const store = useAppStore.getState();
      await loadFromIndexedDB(currentUserId, store);
      setStatus({ type: "success", message: `Seeded ${mockLocations.length} default locations.` });
    } catch (err) {
      setStatus({ type: "error", message: `Failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setSeeding(null);
    }
  };

  const handleSeedPlants = async () => {
    if (!currentUserId) return;
    setSeeding("plants");
    setStatus({ type: null, message: "" });
    try {
      await forceSeedPlants(mockPlants, currentUserId);
      const { loadFromIndexedDB } = await import("@/lib/load-user-data");
      const store = useAppStore.getState();
      await loadFromIndexedDB(currentUserId, store);
      setStatus({ type: "success", message: `Seeded ${mockPlants.length} default plants.` });
    } catch (err) {
      setStatus({ type: "error", message: `Failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setSeeding(null);
    }
  };

  // ── End seeding handlers ──

  const handleClearData = async () => {
    if (!currentUserId) return;
    setClearing(true);
    setStatus({ type: null, message: "" });

    try {
      await clearCurrentUserData();

      // Also clear server-side data
      try {
        await fetch("/api/data", { method: "DELETE" });
      } catch {
        // Server may not be available; that's ok
      }

      // Reset store state for this user's data
      setPlants([]);
      setLocations([]);
      setTags([]);
      setCareEvents([]);
      setJournalEntries([]);
      setInventoryItems([]);
      useAppStore.getState().setTodos([]);
      useAppStore.getState().setReminders([]);
      useAppStore.getState().setProgressEntries([]);
      useAppStore.getState().setActionItems([]);
      useAppStore.getState().setGardenCells([]);

      // Re-seed fresh data from IndexedDB (skip API to avoid old server data)
      const { loadFromIndexedDB } = await import("@/lib/load-user-data");
      const store = useAppStore.getState();
      await loadFromIndexedDB(currentUserId, store);

      setShowClearDialog(false);
      setClearConfirmText("");
      setStatus({
        type: "success",
        message: "Your data has been cleared and reset to defaults.",
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: `Clear failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info size={16} className="mt-0.5 shrink-0 text-[var(--theme-primary)]" />
            <div>
              <h3 className="text-sm font-semibold text-on-surface">
                About Data Storage
              </h3>
              <p className="mt-1 text-xs text-on-surface-variant/70 leading-relaxed">
                All your plant data, care history, inventory, and settings are stored
                locally in your browser&apos;s IndexedDB. Use the tools below to export
                a backup or restore from a previous backup file.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("export")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all ${
            tab === "export"
              ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/30"
              : "bg-surface-container/50 text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <Download size={16} />
          Export
        </button>
        <button
          onClick={() => setTab("import")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all ${
            tab === "import"
              ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/30"
              : "bg-surface-container/50 text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <Upload size={16} />
          Import
        </button>
        <button
          onClick={() => setTab("seed")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all ${
            tab === "seed"
              ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
              : "bg-surface-container/50 text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <Sprout size={16} />
          Seed
        </button>
      </div>

      {/* Export Panel */}
      {tab === "export" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/10">
                  <FileJson
                    size={28}
                    className="text-[var(--theme-primary)]"
                  />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">
                    Export Your Data
                  </h3>
                  <p className="mt-1 text-xs text-on-surface-variant/70 max-w-sm">
                    Download a JSON backup of your personal data including all plants, care
                    history, locations, tags, inventory items, journal entries,
                    garden layout, reminders, and settings.
                  </p>
                </div>
                <Button onClick={handleExport} disabled={exporting} size="lg">
                  {exporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Download Backup
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Import Panel */}
      {tab === "import" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                  <Upload size={28} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">
                    Import Backup
                  </h3>
                  <p className="mt-1 text-xs text-on-surface-variant/70 max-w-sm">
                    Restore your data from a previous backup file. This will
                    <span className="text-red-400 font-semibold"> replace your current data</span> with
                    the imported data.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                  aria-label="Import backup file"
                />
                <Button
                  onClick={handleImportClick}
                  disabled={importing}
                  size="lg"
                  variant="secondary"
                >
                  {importing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Select Backup File
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Seed Panel */}
      {tab === "seed" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <Sprout size={28} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-on-surface">
                    Seed Default Data
                  </h3>
                  <p className="mt-1 text-xs text-on-surface-variant/70 max-w-sm">
                    Populate your account with default plants, tags, and locations.
                    This will <span className="text-amber-400 font-semibold">replace existing data</span> for
                    each category you seed.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={handleSeedTags}
                  disabled={seeding !== null}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-outline/20 bg-surface-container/40 p-4 transition-all hover:bg-surface-container-high hover:border-[var(--theme-primary)]/30 disabled:opacity-50"
                >
                  {seeding === "tags" ? (
                    <Loader2 size={22} className="animate-spin text-[var(--theme-primary)]" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-400">
                      <span className="text-lg">#</span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-on-surface">Tags</span>
                  <span className="text-[10px] text-on-surface-variant/50">{mockTags.length} defaults</span>
                </button>
                <button
                  onClick={handleSeedLocations}
                  disabled={seeding !== null}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-outline/20 bg-surface-container/40 p-4 transition-all hover:bg-surface-container-high hover:border-[var(--theme-primary)]/30 disabled:opacity-50"
                >
                  {seeding === "locations" ? (
                    <Loader2 size={22} className="animate-spin text-[var(--theme-primary)]" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                      <span className="text-lg">📍</span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-on-surface">Locations</span>
                  <span className="text-[10px] text-on-surface-variant/50">{mockLocations.length} defaults</span>
                </button>
                <button
                  onClick={handleSeedPlants}
                  disabled={seeding !== null}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-outline/20 bg-surface-container/40 p-4 transition-all hover:bg-surface-container-high hover:border-[var(--theme-primary)]/30 disabled:opacity-50"
                >
                  {seeding === "plants" ? (
                    <Loader2 size={22} className="animate-spin text-[var(--theme-primary)]" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                      <span className="text-lg">🌱</span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-on-surface">Plants</span>
                  <span className="text-[10px] text-on-surface-variant/50">{mockPlants.length} defaults</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ---- Clear Data Section ---- */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-on-surface">
                Clear Your Data
              </h3>
              <p className="mt-0.5 text-xs text-on-surface-variant/70">
                Remove all your plants, inventory, reminders, journal entries, and
                settings. The application will reset to its default state for your account.
              </p>
              <Button
                className="mt-4"
                variant="danger"
                size="sm"
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 size={14} />
                Clear My Data
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Clear Data Confirmation Dialog ---- */}
      <Dialog
        open={showClearDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowClearDialog(false);
            setClearConfirmText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Your Data?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-red-500/10 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-300 leading-relaxed">
                This will permanently delete all your plants, locations, inventory items,
                reminders, todos, journal entries, progress entries, care history, garden
                layout, uploaded images, and notification/API key settings. Other users
                on this device will not be affected.
              </p>
            </div>

            <p className="text-xs text-on-surface-variant/70">
              Type <strong className="text-red-400">clear my data</strong> to confirm.
            </p>

            <Input
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              placeholder='Type "clear my data" here...'
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowClearDialog(false);
                  setClearConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleClearData}
                disabled={clearConfirmText.toLowerCase() !== "clear my data" || clearing}
              >
                {clearing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {clearing ? "Clearing..." : "Clear My Data"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Message */}
      {status.type && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 flex items-start gap-3 ${
            status.type === "success"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
          )}
          <p className="text-sm">{status.message}</p>
        </motion.div>
      )}
    </div>
  );
}
