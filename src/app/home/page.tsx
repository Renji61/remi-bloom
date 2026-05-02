"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { AnimatePresence } from "framer-motion";
import {
  Search,
  Sprout,
  MapPin,
  FlaskConical,
  RotateCcw,
  Scissors,
  Droplets,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Image,
  LayoutGrid,
  List,
  Sparkles,
  ArrowUpDown,
  CalendarDays,
  Heart,
  Tag,
} from "lucide-react";
import {
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useConfirm,
} from "@/components/ui";
import { PlantCard } from "@/components/greenhouse/plant-card";
import { PlantListView } from "@/components/greenhouse/plant-list-view";
import { useAppStore } from "@/stores/app-store";
import {
  addCareEvent,
  addJournalEntry,
  updatePlant as updatePlantDb,
  deletePlant as deletePlantDb,
  addPlant as addPlantDb,
  uploadImage,
  getImageUrl,
  deleteUploadedImage,
  addActionItem,
} from "@/lib/db";
import { getUserSetting, setUserSetting } from "@/lib/db";
import { generateId, formatDateShort, formatDate } from "@/lib/utils";
import nextDynamic from "next/dynamic";
import { PWAInstallPrompt } from "@/components/layout/pwa-install-prompt";
import { SafeImage } from "@/components/ui/safe-image";

const IdentifyPlantDialog = nextDynamic(
  () => import("@/components/lab/identify-plant-dialog").then((m) => m.IdentifyPlantDialog),
  { ssr: false }
);
import type { IdentifyResult } from "@/components/lab/identify-plant-dialog";
import { usePageTitle } from "@/hooks/use-page-title";
import { useScopedPlants } from "@/hooks/use-scoped-plants";
import { useGardenRole } from "@/hooks/use-garden-role";
import { useSharedGardenSync } from "@/hooks/use-shared-garden-sync";
import { getCareEventsForPlantToday } from "@/lib/db";
import type { CareEvent, Plant, JournalEntry, ActionItem } from "@/lib/db";

// ---- Emoji & tag color presets ----
const plantEmojis = [
  "🌿", "🌳", "🌵", "🍃", "🪷", "🌱", "🌴", "🌸", "🌻", "🍀",
  "🎋", "🌺", "🪻", "🌲", "🌾", "🍂", "🪴", "🌷", "🌹", "🍄",
];

const tagColors = [
  "#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#fbbf24",
  "#fb923c", "#2dd4bf", "#f87171", "#e879f9", "#facc15",
];

export default function HomePage() {
  const { confirm, alert: remiAlert } = useConfirm();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentUser = useAppStore((s) => s.currentUser);
  const greenhouseName = useAppStore((s) => s.greenhouseName);
  usePageTitle(greenhouseName);
  const plants = useAppStore((s) => s.plants);
  const locations = useAppStore((s) => s.locations);
  const tags = useAppStore((s) => s.tags);
  const careEvents = useAppStore((s) => s.careEvents);
  const addCareEventToStore = useAppStore((s) => s.addCareEvent);
  const addJournalEntryToStore = useAppStore((s) => s.addJournalEntry);
  const updatePlantInStore = useAppStore((s) => s.updatePlant);
  const addPlantToStore = useAppStore((s) => s.addPlant);
  const removePlantFromStore = useAppStore((s) => s.removePlant);
  const selectedPlantId = useAppStore((s) => s.selectedPlantId);
  const setSelectedPlantId = useAppStore((s) => s.setSelectedPlantId);

  // Shared garden role + scope
  const scopedPlants = useScopedPlants(plants);
  const gardenPermissions = useGardenRole();
  useSharedGardenSync();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [needsCareFilter, setNeedsCareFilter] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Plant sort state
  const [plantSortKey, setPlantSortKey] = useState<"createdAt" | "name">("name");
  const [plantSortDirection, setPlantSortDirection] = useState<"asc" | "desc">("asc");
  const [plantSortLoaded, setPlantSortLoaded] = useState(false);

  // Load saved sort preferences
  useEffect(() => {
    async function loadSort() {
      if (!currentUserId) return;
      const [key, dir] = await Promise.all([
        getUserSetting(currentUserId, "homeSortKey"),
        getUserSetting(currentUserId, "homeSortDirection"),
      ]);
      if (key === "createdAt" || key === "name") setPlantSortKey(key);
      if (dir === "asc" || dir === "desc") setPlantSortDirection(dir);
      setPlantSortLoaded(true);
    }
    loadSort();
  }, [currentUserId]);

  // Save sort preferences when they change
  useEffect(() => {
    if (!currentUserId || !plantSortLoaded) return;
    setUserSetting(currentUserId, "homeSortKey", plantSortKey);
    setUserSetting(currentUserId, "homeSortDirection", plantSortDirection);
  }, [plantSortKey, plantSortDirection, currentUserId, plantSortLoaded]);

  // Plant form state
  const [showPlantForm, setShowPlantForm] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [plantForm, setPlantForm] = useState({
    name: "",
    scientificName: "",
    description: "",
    emoji: "🌿",
    imageUrl: "",
    plantedDate: "",
    locationId: "none",
    tags: [] as string[],
  });

  // Image upload state
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify Plants dialog
  const [showIdentifyDialog, setShowIdentifyDialog] = useState(false);
  const pendingCareTasksRef = useRef<ActionItem[]>([]);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Thumbnail cache for plant images
  const [plantThumbnails, setPlantThumbnails] = useState<Record<string, string>>({});

  const lastCareByPlant = useMemo(() => {
    const map: Record<string, CareEvent> = {};
    for (const event of careEvents) {
      if (!map[event.plantId]) {
        map[event.plantId] = event;
      }
    }
    return map;
  }, [careEvents]);

  const locationMap = useMemo(() => {
    const map: Record<string, (typeof locations)[0]> = {};
    for (const loc of locations) map[loc.id] = loc;
    return map;
  }, [locations]);

  const tagMap = useMemo(() => {
    const map: Record<string, (typeof tags)[0]> = {};
    for (const t of tags) map[t.id] = t;
    return map;
  }, [tags]);

  // Load thumbnails for plants with uploaded images
  useEffect(() => {
    const pending: { id: string; isLegacy: boolean }[] = [];
    for (const plant of plants) {
      if (plant.imageUrl) {
        if (plant.imageUrl.startsWith("upload:")) {
          const imageId = plant.imageUrl.slice(7);
          if (!plantThumbnails[imageId]) pending.push({ id: imageId, isLegacy: true });
        } else if (plant.imageUrl.startsWith("/uploads/")) {
          if (!plantThumbnails[plant.imageUrl]) pending.push({ id: plant.imageUrl, isLegacy: false });
        }
      }
    }
    if (pending.length === 0) return;
    Promise.all(
      pending.map(async (item) => {
        if (item.isLegacy) {
          const url = await getImageUrl(item.id);
          if (url) return { id: item.id, url };
        } else {
          return { id: item.id, url: item.id };
        }
        return null;
      })
    )    .then((results) => {
      const updates: Record<string, string> = {};
      for (const r of results) {
        if (r) {
          updates[r.id] = r.url;
        }
      }
      if (Object.keys(updates).length > 0) {
        setPlantThumbnails((prev) => ({ ...prev, ...updates }));
      }
    });
  }, [plants, plantThumbnails]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const filteredPlants = useMemo(() => {
    let list = scopedPlants;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.scientificName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    if (locationFilter) {
      list = list.filter((p) => p.locationId === locationFilter);
    }
    if (tagFilter) {
      list = list.filter((p) => p.tags?.includes(tagFilter));
    }
    if (needsCareFilter) {
      const now = Date.now();
      list = list.filter((p) => {
        const last = lastCareByPlant[p.id];
        if (!last) return true;
        const daysSince =
          (now - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 3;
      });
    }
    // Sort
    list = [...list].sort((a, b) => {
      let cmp: number;
      if (plantSortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      }
      if (cmp === 0) {
        cmp = a.name.localeCompare(b.name);
      }
      return plantSortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [scopedPlants, debouncedSearch, locationFilter, tagFilter, needsCareFilter, lastCareByPlant, plantSortKey, plantSortDirection]);

  const logQuickCare = useCallback(
    async (plantId: string, type: "water" | "fertilize") => {
      const plant = plants.find((p) => p.id === plantId);
      if (!plant) return;

      // Duplicate detection — check if someone already logged this today
      const existing = await getCareEventsForPlantToday(plantId, type);
      if (existing.length > 0) {
        const lastEvent = existing[existing.length - 1];
        if (lastEvent.performedBy && lastEvent.performedBy !== currentUser?.displayName) {
          await remiAlert(`This action was just logged by ${lastEvent.performedBy}. Duplicate ignored.`);
          return;
        }
      }

      const performedByName = currentUser?.displayName ?? "Unknown";
      const event: CareEvent = {
        id: generateId(),
        userId: currentUserId ?? "",
        plantId,
        plantName: plant.name,
        type,
        date: new Date().toISOString().split("T")[0],
        note: type === "water" ? "Quick watered" : "Quick fertilized",
        performedBy: performedByName,
      };
      await addCareEvent(event);
      addCareEventToStore(event);

      // Also add a journal entry
      const journalEntry: JournalEntry = {
        id: generateId(),
        userId: currentUserId ?? "",
        plantId,
        plantName: plant.name,
        note: type === "water" ? "💧 Watered the plant." : "🧪 Fertilized the plant.",
        date: new Date().toISOString(),
        performedBy: performedByName,
      };
      await addJournalEntry(journalEntry);
      addJournalEntryToStore(journalEntry);
    },
    [plants, currentUserId, currentUser, addCareEventToStore, addJournalEntryToStore]
  );

  const selectedPlant = useMemo(
    () => plants.find((p) => p.id === selectedPlantId) ?? null,
    [plants, selectedPlantId]
  );

  // ---- Plant Form ----
  const resetPlantForm = () => {
    setShowPlantForm(false);
    setEditingPlant(null);
    setPlantForm({
      name: "",
      scientificName: "",
      description: "",
      emoji: "🌿",
      imageUrl: "",
      plantedDate: "",
      locationId: "none",
      tags: [],
    });
    // Just clear upload state — don't delete from IndexedDB
    // (the saved plant still references this image via "upload:<id>")
    if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
    setUploadedImageId(null);
    setUploadedImageUrl(null);
    setUploadError(null);
    pendingCareTasksRef.current = [];
  };

  const openAddForm = (prefill?: Partial<typeof plantForm>) => {
    resetPlantForm();
    if (prefill) {
      setPlantForm((prev) => ({ ...prev, ...prefill }));
    }
    setShowPlantForm(true);
  };

  const openEditForm = (plant: Plant) => {
    setEditingPlant(plant);
    setPlantForm({
      name: plant.name,
      scientificName: plant.scientificName,
      description: plant.description,
      emoji: plant.emoji,
      imageUrl: plant.imageUrl,
      plantedDate: plant.plantedDate?.substring(0, 10) ?? "",
      locationId: plant.locationId || "none",
      tags: [...plant.tags],
    });
    if (plant.imageUrl) {
      if (plant.imageUrl.startsWith("upload:")) {
        const imageId = plant.imageUrl.slice(7);
        setUploadedImageId(imageId);
        getImageUrl(imageId).then((url) => {
          if (url) setUploadedImageUrl(url);
        });
      } else if (plant.imageUrl.startsWith("/uploads/")) {
        setUploadedImageId(plant.imageUrl);
        setUploadedImageUrl(plant.imageUrl);
      }
    }
    setShowPlantForm(true);
  };

  const handleSavePlant = async () => {
    if (!plantForm.name.trim()) return;

    let imageUrlFinal = plantForm.imageUrl.trim();

    if (editingPlant) {
      const updated: Plant = {
        ...editingPlant,
        name: plantForm.name.trim(),
        scientificName: plantForm.scientificName.trim(),
        description: plantForm.description.trim(),
        emoji: plantForm.emoji,
        imageUrl: imageUrlFinal,
        locationId: plantForm.locationId === "none" ? null : plantForm.locationId,
        tags: plantForm.tags,
        plantedDate: plantForm.plantedDate?.substring(0, 10) || null,
      };
      await updatePlantDb(updated);
      updatePlantInStore(updated);
    } else {
      const plantId = generateId();
      const newPlant: Plant = {
        id: plantId,
        userId: currentUserId ?? "",
        name: plantForm.name.trim(),
        scientificName: plantForm.scientificName.trim(),
        description: plantForm.description.trim(),
        emoji: plantForm.emoji,
        imageUrl: imageUrlFinal,
        createdAt: new Date().toISOString().split("T")[0],
        plantedDate: plantForm.plantedDate?.substring(0, 10) || null,
        locationId: plantForm.locationId === "none" ? null : plantForm.locationId,
        tags: plantForm.tags,
      };
      await addPlantDb(newPlant);
      addPlantToStore(newPlant);

      // Save care tasks created from identification
      if (pendingCareTasksRef.current && pendingCareTasksRef.current.length > 0) {
        for (const task of pendingCareTasksRef.current) {
          await addActionItem({
            ...task,
            id: task.id || generateId(),
            userId: currentUserId ?? "",
            plantIds: [plantId],
          });
        }
        pendingCareTasksRef.current = [];
      }
    }
    resetPlantForm();
  };

  const handleDeletePlant = async (id: string) => {
    const plant = plants.find((p) => p.id === id);
    const plantName = plant?.name ?? "this plant";
    if (!await confirm({ message: `Delete ${plantName}? This will remove the plant and cannot be undone.`, confirmLabel: "Delete", variant: "danger" })) {
      return;
    }

    if (plant?.imageUrl) {
      if (plant.imageUrl.startsWith("upload:")) {
        const imageId = plant.imageUrl.slice(7);
        await deleteUploadedImage(imageId);
        if (plantThumbnails[imageId]) {
          URL.revokeObjectURL(plantThumbnails[imageId]);
        }
      } else if (plant.imageUrl.startsWith("/uploads/")) {
        if (plantThumbnails[plant.imageUrl]) {
          URL.revokeObjectURL(plantThumbnails[plant.imageUrl]);
        }
      }
    }
    await deletePlantDb(id);
    removePlantFromStore(id);
    if (openDetail && selectedPlantId === id) {
      setOpenDetail(false);
      setSelectedPlantId(null);
    }
  };

  // --- Identify Plants callback ---
  const handleIdentifyComplete = useCallback((result: IdentifyResult) => {
    setShowIdentifyDialog(false);
    // Open the add plant form with pre-filled data
    openAddForm({
      name: result.name,
      scientificName: result.scientificName,
      description: result.description,
      imageUrl: result.imageUrl,
    });
    // Store care tasks AFTER openAddForm so resetPlantForm doesn't clear them
    pendingCareTasksRef.current = result.careTasks;
    // If an image was uploaded, track it
    if (result.imageUrl) {
      if (result.imageUrl.startsWith("upload:")) {
        const imageId = result.imageUrl.slice(7);
        setUploadedImageId(imageId);
        getImageUrl(imageId).then((url) => {
          if (url) setUploadedImageUrl(url);
        });
      } else if (result.imageUrl.startsWith("/uploads/")) {
        setUploadedImageId(result.imageUrl);
        setUploadedImageUrl(result.imageUrl);
      }
    }
  }, []);

  const toggleTagInForm = (tagId: string) => {
    setPlantForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter((t) => t !== tagId)
        : [...prev.tags, tagId],
    }));
  };

  // File upload handler for plants
  const handlePlantFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      if (uploadedImageId) {
        await deleteUploadedImage(uploadedImageId);
        if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      }

      const url = await uploadImage(file);

      setUploadedImageId(url);
      setUploadedImageUrl(url);
      setPlantForm((prev) => ({
        ...prev,
        imageUrl: url,
      }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePlantUploadedImage = () => {
    if (uploadedImageId) {
      deleteUploadedImage(uploadedImageId);
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
    }
    setUploadedImageId(null);
    setUploadedImageUrl(null);
    setPlantForm((prev) => ({ ...prev, imageUrl: "" }));
  };

  // Helper to get plant image URL (handles upload: prefix)
  const getPlantThumbnail = (plant: Plant): string | null => {
    if (plant.imageUrl && plant.imageUrl.startsWith("upload:")) {
      const imageId = plant.imageUrl.slice(7);
      return plantThumbnails[imageId] ?? null;
    }
    if (plant.imageUrl && !plant.imageUrl.startsWith("upload:")) {
      return plant.imageUrl;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <PWAInstallPrompt />
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-on-surface-variant/70">
              {filteredPlants.length} of {plants.length} plants
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {gardenPermissions.canAddPlants && (
              <>
                {gardenPermissions.canAddPlants && (
                  <IdentifyPlantButton onClick={() => setShowIdentifyDialog(true)} />
                )}
                <Button onClick={() => openAddForm()} size="sm" className="shrink-0">
                  <Plus size={14} />
                  <span className="hidden sm:inline">Add Plant</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filter row – scrollable on mobile */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1.5 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            aria-label={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
          >
            {viewMode === "grid" ? (
              <List size={14} aria-hidden="true" />
            ) : (
              <LayoutGrid size={14} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {viewMode === "grid" ? "List" : "Grid"}
            </span>
          </button>
          <button
            onClick={() => setNeedsCareFilter(!needsCareFilter)}
            aria-pressed={needsCareFilter}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all flex items-center gap-1.5 ${
              needsCareFilter
                ? "bg-amber-500/20 text-amber-500"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            <Heart size={12} aria-hidden="true" className="hidden sm:inline" />
            Needs Care
          </button>
          <div className="flex gap-1 rounded-lg bg-surface-container-high/40 p-0.5">
            <button
              onClick={() => {
                if (plantSortKey !== "name") {
                  setPlantSortKey("name");
                  setPlantSortDirection("asc");
                } else {
                  setPlantSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                }
              }}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors flex items-center gap-1 ${
                plantSortKey === "name"
                  ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                  : "text-on-surface-variant/60 hover:text-on-surface"
              }`}
            >
              <ArrowUpDown size={12} aria-hidden="true" className="hidden sm:block" />
              Name
              <span className="text-[9px]">
                {plantSortKey === "name" ? (plantSortDirection === "asc" ? "A→Z" : "Z→A") : ""}
              </span>
            </button>
            <button
              onClick={() => {
                if (plantSortKey !== "createdAt") {
                  setPlantSortKey("createdAt");
                  setPlantSortDirection("desc");
                } else {
                  setPlantSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
                }
              }}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors flex items-center gap-1 ${
                plantSortKey === "createdAt"
                  ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                  : "text-on-surface-variant/60 hover:text-on-surface"
              }`}
            >
              <CalendarDays size={12} aria-hidden="true" className="hidden sm:block" />
              Date
            </button>
          </div>
          <button
            onClick={() =>
              setLocationFilter(
                locationFilter ? null : locations[0]?.id ?? null
              )
            }
            aria-pressed={!!locationFilter}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              locationFilter
                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            <MapPin size={10} className="hidden sm:inline mr-1" aria-hidden="true" />
            Location
          </button>
          <button
            onClick={() =>
              setTagFilter(tagFilter ? null : tags[0]?.id ?? null)
            }
            aria-pressed={!!tagFilter}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              tagFilter
                ? "bg-purple-500/20 text-purple-500"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            <Tag size={12} aria-hidden="true" className="hidden sm:inline mr-1" />
            Tags
          </button>
        </div>
      </div>

      {/* Location Filter Chips */}
      {locationFilter && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setLocationFilter(null)}
            className="rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            All
          </button>
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setLocationFilter(loc.id)}
              className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                locationFilter === loc.id
                  ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {loc.emoji} {loc.name}
            </button>
          ))}
        </div>
      )}

      {/* Tag Filter Chips */}
      {tagFilter && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTagFilter(null)}
            className="rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            All Tags
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagFilter(tag.id)}
              className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                tagFilter === tag.id
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full mr-1"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Search plants by name, scientific name, or description..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search plants"
      />

      {/* Plant Grid / List */}
      {filteredPlants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center" role="alert" aria-live="polite">
          <Sprout size={40} className="mb-3 text-on-surface-variant/50" />
          <p className="text-sm font-medium text-on-surface-variant">
            No plants found
          </p>
          <p className="text-xs text-on-surface-variant/50">
            Try adjusting your search or filters
          </p>
          {gardenPermissions.canAddPlants && (
            <Button onClick={() => openAddForm()} className="mt-4" size="sm">
              <Plus size={14} />
              Add Your First Plant
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filteredPlants.map((plant, i) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                thumbnailUrl={getPlantThumbnail(plant)}
                lastCareEvent={lastCareByPlant[plant.id]}
                location={
                  plant.locationId ? locationMap[plant.locationId] : undefined
                }
                onQuickWater={() => logQuickCare(plant.id, "water")}
                onQuickFertilize={() => logQuickCare(plant.id, "fertilize")}
                onOpenDetail={() => {
                  setSelectedPlantId(plant.id);
                  setOpenDetail(true);
                }}
                onEdit={gardenPermissions.canEdit ? () => openEditForm(plant) : undefined}
                canDelete={gardenPermissions.canDeletePlants}
                canLogCare={gardenPermissions.canLogCare}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredPlants.map((plant, i) => (
              <PlantListView
                key={plant.id}
                plant={plant}
                thumbnailUrl={getPlantThumbnail(plant)}
                lastCareEvent={lastCareByPlant[plant.id]}
                location={
                  plant.locationId ? locationMap[plant.locationId] : undefined
                }
                onQuickWater={gardenPermissions.canLogCare ? () => logQuickCare(plant.id, "water") : undefined}
                onQuickFertilize={gardenPermissions.canLogCare ? () => logQuickCare(plant.id, "fertilize") : undefined}
                onOpenDetail={() => {
                  setSelectedPlantId(plant.id);
                  setOpenDetail(true);
                }}
                onEdit={gardenPermissions.canEdit ? () => openEditForm(plant) : undefined}
                canDelete={gardenPermissions.canDeletePlants}
                canLogCare={gardenPermissions.canLogCare}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Plant Detail Dialog */}
      <Dialog open={openDetail && !!selectedPlant} onOpenChange={setOpenDetail}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPlant?.emoji} {selectedPlant?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedPlant && gardenPermissions.role !== null && !gardenPermissions.canEdit && !scopedPlants.find((p) => p.id === selectedPlant.id) ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-on-surface-variant">This plant is not in your shared scope.</p>
            </div>
          ) : selectedPlant && (
            <PlantDetail
              plant={selectedPlant}
              thumbnailUrl={getPlantThumbnail(selectedPlant)}
              location={
                selectedPlant.locationId
                  ? locationMap[selectedPlant.locationId]
                  : undefined
              }
              tags={selectedPlant.tags?.map((t) => tagMap[t]).filter(Boolean) ?? []}
              careEvents={careEvents.filter(
                (e) => e.plantId === selectedPlant.id
              )}
              onQuickWater={gardenPermissions.canLogCare ? () => logQuickCare(selectedPlant.id, "water") : undefined}
              onQuickFertilize={gardenPermissions.canLogCare ? () =>
                logQuickCare(selectedPlant.id, "fertilize")
              : undefined}
              onEdit={gardenPermissions.canEdit ? () => {
                setOpenDetail(false);
                openEditForm(selectedPlant);
              } : undefined}
              onDelete={gardenPermissions.canDeletePlants ? () => handleDeletePlant(selectedPlant.id) : undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Plant Dialog */}
      <Dialog
        open={showPlantForm}
        onOpenChange={(open) => {
          if (!open) resetPlantForm();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlant ? "Edit Plant" : "Add New Plant"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Emoji Picker */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Emoji
              </label>
              <div className="flex flex-wrap gap-1.5">
                {plantEmojis.map((e) => (
                  <button
                    key={e}
                    onClick={() =>
                      setPlantForm((prev) => ({ ...prev, emoji: e }))
                    }
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all ${
                      plantForm.emoji === e
                        ? "bg-[var(--theme-primary)]/20 ring-1 ring-[var(--theme-primary)] scale-110"
                        : "bg-surface-container-high hover:bg-surface-container-higher"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Plant Name *"
              value={plantForm.name}
              onChange={(e) =>
                setPlantForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. Monstera Deliciosa"
            />
            <Input
              label="Scientific Name"
              value={plantForm.scientificName}
              onChange={(e) =>
                setPlantForm((prev) => ({
                  ...prev,
                  scientificName: e.target.value,
                }))
              }
              placeholder="e.g. Monstera deliciosa"
            />
            <div>
              <label htmlFor="note-home" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Description
              </label>
              <textarea
                id="note-home"
                value={plantForm.description}
                onChange={(e) =>
                  setPlantForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe your plant — care tips, origin, notes..."
                className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
                rows={3}
              />
            </div>

            {/* Planted Date */}
            <div>
              <label htmlFor="planted-date" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                <Sprout size={12} className="inline mr-1" />
                Planted Date
              </label>
              <input
                id="planted-date"
                type="date"
                value={plantForm.plantedDate}
                onChange={(e) =>
                  setPlantForm((prev) => ({
                    ...prev,
                    plantedDate: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3 text-sm text-on-surface backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
              />
            </div>

            {/* Photo URL & Upload */}
            <div className="rounded-xl border border-outline/10 bg-surface-container/20 p-3">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  <Image size={12} />
                  Photo (optional)
                </label>
                <Input
                  value={plantForm.imageUrl.startsWith("upload:") ? "" : plantForm.imageUrl}
                  onChange={(e) => {
                    setPlantForm((prev) => ({
                      ...prev,
                      imageUrl: e.target.value,
                    }));
                    if (uploadedImageId) removePlantUploadedImage();
                  }}
                  placeholder="https://example.com/photo.jpg"
                />
                {plantForm.imageUrl && !plantForm.imageUrl.startsWith("upload:") && (
                  <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-2xl bg-surface-container-high">
                    <SafeImage
                      src={plantForm.imageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                {/* Image Upload */}
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,image/tiff"
                    className="hidden"
                    onChange={handlePlantFileUpload}
                    aria-label="Upload plant image"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-outline/30 bg-surface-container/30 px-3 py-2 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container/60 hover:border-[var(--theme-primary)]/30"
                    >
                      {uploading ? (
                        <>
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={12} />
                          Choose Image
                        </>
                      )}
                    </button>
                    <span className="text-[9px] text-on-surface-variant/50">
                      JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF (max 10MB)
                    </span>
                  </div>

                  {uploadError && (
                    <p className="mt-1.5 text-[11px] text-red-400">{uploadError}</p>
                  )}

                  {uploadedImageUrl && (
                    <div className="relative mt-2 inline-block">
                      <div className="h-20 w-20 overflow-hidden rounded-xl bg-surface-container-high">
                        <SafeImage
                          src={uploadedImageUrl}
                          alt="Uploaded preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removePlantUploadedImage}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-110"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

            {/* Location Select */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Location
              </label>
              <Select
                value={plantForm.locationId}
                onValueChange={(v) =>
                  setPlantForm((prev) => ({ ...prev, locationId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a location..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.emoji} {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags Multi-Select */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = plantForm.tags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTagInForm(tag.id)}
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold transition-all ${
                        active
                          ? "bg-surface-container-high ring-1 ring-white/20"
                          : "bg-surface-container/60 text-on-surface-variant/60"
                      }`}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full mr-1"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={resetPlantForm}>
                Cancel
              </Button>
              <Button onClick={handleSavePlant} disabled={!plantForm.name.trim()}>
                {editingPlant ? "Save Changes" : "Add Plant"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Identify Plants Dialog */}
      <IdentifyPlantDialog
        open={showIdentifyDialog}
        onOpenChange={setShowIdentifyDialog}
        onComplete={handleIdentifyComplete}
      />
    </div>
  );
}

function PlantDetail({
  plant,
  location,
  tags,
  careEvents,
  onQuickWater,
  onQuickFertilize,
  onEdit,
  onDelete,
  thumbnailUrl,
}: {
  plant: { id: string; name: string; scientificName: string; description: string; emoji: string; imageUrl: string; createdAt: string; plantedDate: string | null };
  location?: { name: string; emoji: string; description: string };
  tags: { id: string; name: string; color: string }[];
  careEvents: CareEvent[];
  onQuickWater?: () => void;
  onQuickFertilize?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  thumbnailUrl?: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Quick Info */}
      <div className="rounded-2xl bg-surface-container/50 p-4">
        <div className="flex items-start gap-3">
          {thumbnailUrl ? (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
              <SafeImage
                src={thumbnailUrl}
                alt={plant.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : plant.imageUrl && !plant.imageUrl.startsWith("upload:") ? (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
              <SafeImage
                src={plant.imageUrl}
                alt={plant.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-3xl">
              {plant.emoji}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-on-surface">{plant.name}</h3>
            <p className="text-xs italic text-on-surface-variant/70">
              {plant.scientificName}
            </p>
            {location && (
              <div className="mt-1 flex items-center gap-1.5">
                <MapPin size={11} className="text-[var(--theme-primary)]/60" />
                <span className="text-xs text-[var(--theme-primary)]/70">
                  {location.emoji} {location.name}
                </span>
              </div>
            )}
            <p className="mt-1 text-xs text-on-surface-variant/70">
              {plant.plantedDate
                ? `Planted ${formatDate(new Date(plant.plantedDate))}`
                : `Added ${formatDate(new Date(plant.createdAt))}`}
            </p>
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {plant.description && (
          <p className="mt-3 text-xs text-on-surface-variant/80 leading-relaxed">
            {plant.description}
          </p>
        )}
        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const hex = tag.color.replace("#", "");
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              const brightness = (r * 299 + g * 587 + b * 114) / 1000;
              const textColor = brightness > 128 ? "rgba(0,0,0,0.7)" : "#fff";
              return (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: tag.color + "30",
                    color: textColor,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {(onQuickWater || onQuickFertilize) && (
        <div className="flex gap-2">
          {onQuickWater && (
            <button
              onClick={onQuickWater}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-500 transition-colors hover:bg-blue-500/20"
            >
              <Droplets size={14} />
              Log Water
            </button>
          )}
          {onQuickFertilize && (
            <button
              onClick={onQuickFertilize}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20"
            >
              <FlaskConical size={14} />
              Log Fertilize
            </button>
          )}
        </div>
      )}

      {/* Care History */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant/70">
          Care History
        </h4>
        {careEvents.length === 0 ? (
          <p className="text-xs text-on-surface-variant/50">
            No care events logged yet.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {careEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2.5 rounded-xl bg-surface-container/30 px-3 py-2"
              >
                <CareIcon type={event.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-on-surface capitalize">
                      {event.type}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/50">
                      {formatDateShort(new Date(event.date))}
                    </span>
                  </div>
                  {event.note && (
                    <p className="mt-0.5 text-[10px] text-on-surface-variant/70 leading-relaxed">
                      {event.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CareIcon({ type }: { type: CareEvent["type"] }) {
  const props = { size: 14 };
  switch (type) {
    case "water":
      return <Droplets {...props} className="shrink-0 text-blue-500" />;
    case "fertilize":
      return <FlaskConical {...props} className="shrink-0 text-emerald-500" />;
    case "repot":
      return <RotateCcw {...props} className="shrink-0 text-amber-500" />;
    case "prune":
      return <Scissors {...props} className="shrink-0 text-purple-500" />;
    default:
      return <Sprout {...props} className="shrink-0 text-on-surface-variant" />;
  }
}

function IdentifyPlantButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--theme-primary)]/10 px-3 py-1.5 text-[10px] font-semibold text-[var(--theme-primary)] transition-all hover:bg-[var(--theme-primary)]/20 mr-1"
    >
      <Sparkles size={12} />
      <span className="hidden sm:inline">Identify Plants</span>
      <span className="sm:hidden">Identify Plant</span>
    </button>
  );
}

// ---- Inline Test for Plant Form Fields ----
function testPlantFormFields(): string[] {
  const results: string[] = [];

  function assert(description: string, pass: boolean) {
    results.push(`${pass ? "PASS" : "FAIL"}: ${description}`);
  }

  // Test 1: openEditForm with plantedDate as ISO timestamp (from Postgres sync)
  const plantWithTs: Plant = {
    id: "test-1",
    userId: "user-1",
    name: "Monstera",
    scientificName: "Monstera deliciosa",
    description: "A beautiful plant",
    emoji: "🌿",
    imageUrl: "https://example.com/photo.jpg",
    createdAt: "2024-01-15",
    plantedDate: "2024-03-15T00:00:00.000Z",
    locationId: "loc-1",
    tags: ["tag-1", "tag-2"],
  };
  const formFromTs = {
    name: plantWithTs.name,
    scientificName: plantWithTs.scientificName,
    description: plantWithTs.description,
    emoji: plantWithTs.emoji,
    imageUrl: plantWithTs.imageUrl,
    plantedDate: plantWithTs.plantedDate?.substring(0, 10) ?? "",
    locationId: plantWithTs.locationId || "none",
    tags: [...plantWithTs.tags],
  };
  assert("name matches after ISO timestamp plantedDate", formFromTs.name === "Monstera");
  assert("scientificName matches", formFromTs.scientificName === "Monstera deliciosa");
  assert("description matches", formFromTs.description === "A beautiful plant");
  assert("emoji matches", formFromTs.emoji === "🌿");
  assert("imageUrl matches", formFromTs.imageUrl === "https://example.com/photo.jpg");
  assert("plantedDate is YYYY-MM-DD (not ISO timestamp)", formFromTs.plantedDate === "2024-03-15");
  assert("plantedDate is exactly 10 chars", formFromTs.plantedDate.length === 10);
  assert("locationId matches", formFromTs.locationId === "loc-1");
  assert("tags array preserved", formFromTs.tags.length === 2 && formFromTs.tags[0] === "tag-1");

  // Test 2: openEditForm with plantedDate as clean YYYY-MM-DD (from IndexedDB)
  const plantWithClean: Plant = {
    ...plantWithTs,
    plantedDate: "2024-03-15",
  };
  const formFromClean = {
    ...plantWithClean,
    plantedDate: plantWithClean.plantedDate?.substring(0, 10) ?? "",
  };
  assert("clean plantedDate stays unchanged", formFromClean.plantedDate === "2024-03-15");

  // Test 3: openEditForm with plantedDate as null
  const plantWithNull: Plant = {
    ...plantWithTs,
    plantedDate: null,
  };
  const formFromNull = {
    ...plantWithNull,
    plantedDate: plantWithNull.plantedDate?.substring(0, 10) ?? "",
  };
  assert("null plantedDate becomes empty string", formFromNull.plantedDate === "");

  // Test 4: handleSavePlant update path — normalize plantedDate before saving
  const updateForm = { ...formFromTs, plantedDate: "2024-03-15T00:00:00.000Z" };
  const savedUpdate = {
    ...plantWithTs,
    plantedDate: updateForm.plantedDate?.substring(0, 10) || null,
  };
  assert("save normalizes plantedDate to YYYY-MM-DD", savedUpdate.plantedDate === "2024-03-15");

  // Test 5: handleSavePlant update path — empty plantedDate becomes null
  const updateFormEmpty = { ...formFromTs, plantedDate: "" };
  const savedUpdateEmpty = {
    ...plantWithTs,
    plantedDate: updateFormEmpty.plantedDate?.substring(0, 10) || null,
  };
  assert("empty plantedDate becomes null on save", savedUpdateEmpty.plantedDate === null);

  // Test 6: handleSavePlant create path — normalize plantedDate
  const createForm = { ...formFromTs, plantedDate: "2024-06-01" };
  const savedCreate = {
    id: "new-id",
    userId: "user-1",
    name: createForm.name,
    scientificName: createForm.scientificName,
    description: createForm.description,
    emoji: createForm.emoji,
    imageUrl: createForm.imageUrl,
    createdAt: "2024-06-01",
    plantedDate: createForm.plantedDate?.substring(0, 10) || null,
    locationId: createForm.locationId === "none" ? null : createForm.locationId,
    tags: createForm.tags,
  };
  assert("create normalizes plantedDate", savedCreate.plantedDate === "2024-06-01");
  assert("locationId 'none' becomes null on create", savedCreate.locationId === null);

  // Print results
  console.log("--- Plant Form Field Test Results ---");
  results.forEach((r) => console.log(r));
  const passCount = results.filter((r) => r.startsWith("PASS")).length;
  const failCount = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`Total: ${passCount} passed, ${failCount} failed, ${results.length} total`);

  return results;
}

// Expose for manual QA in browser console
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).testPlantFormFields = testPlantFormFields;
}
