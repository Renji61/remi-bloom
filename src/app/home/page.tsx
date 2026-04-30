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
  usePageTitle("My Greenhouse");
  const currentUserId = useAppStore((s) => s.currentUserId);
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

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [needsCareFilter, setNeedsCareFilter] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
    const pending: string[] = [];
    for (const plant of plants) {
      if (plant.imageUrl && plant.imageUrl.startsWith("upload:")) {
        const imageId = plant.imageUrl.slice(7);
        if (!plantThumbnails[imageId]) pending.push(imageId);
      }
    }
    if (pending.length === 0) return;
    Promise.all(
      pending.map(async (id) => {
        const url = await getImageUrl(id);
        if (url) return { id, url };
        return null;
      })
    ).then((results) => {
      const updates: Record<string, string> = {};
      for (const r of results) {
        if (r) updates[r.id] = r.url;
      }
      if (Object.keys(updates).length > 0) {
        setPlantThumbnails((prev) => ({ ...prev, ...updates }));
      }
    });
  }, [plants, plantThumbnails]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(plantThumbnails).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const filteredPlants = useMemo(() => {
    let list = plants;
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
    return list;
  }, [plants, debouncedSearch, locationFilter, tagFilter, needsCareFilter, lastCareByPlant]);

  const logQuickCare = useCallback(
    async (plantId: string, type: "water" | "fertilize") => {
      const plant = plants.find((p) => p.id === plantId);
      if (!plant) return;
      const event: CareEvent = {
        id: generateId(),
        userId: currentUserId ?? "",
        plantId,
        plantName: plant.name,
        type,
        date: new Date().toISOString().split("T")[0],
        note: type === "water" ? "Quick watered" : "Quick fertilized",
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
      };
      await addJournalEntry(journalEntry);
      addJournalEntryToStore(journalEntry);
    },
    [plants, addCareEventToStore, addJournalEntryToStore]
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

  const openAddForm = () => {
    resetPlantForm();
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
      plantedDate: plant.plantedDate ?? "",
      locationId: plant.locationId || "none",
      tags: [...plant.tags],
    });
    if (plant.imageUrl && plant.imageUrl.startsWith("upload:")) {
      const imageId = plant.imageUrl.slice(7);
      setUploadedImageId(imageId);
      getImageUrl(imageId).then((url) => {
        if (url) setUploadedImageUrl(url);
      });
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
        plantedDate: plantForm.plantedDate || null,
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
        plantedDate: plantForm.plantedDate || null,
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
    if (!window.confirm(`Delete ${plantName}? This will remove the plant and cannot be undone.`)) {
      return;
    }

    if (plant?.imageUrl && plant.imageUrl.startsWith("upload:")) {
      const imageId = plant.imageUrl.slice(7);
      await deleteUploadedImage(imageId);
      if (plantThumbnails[imageId]) {
        URL.revokeObjectURL(plantThumbnails[imageId]);
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
    // Pre-fill the plant form with identification results
    setPlantForm((prev) => ({
      ...prev,
      name: result.name,
      scientificName: result.scientificName,
      description: result.description,
      imageUrl: result.imageUrl,
    }));
    // Store care tasks for when the plant is saved
    pendingCareTasksRef.current = result.careTasks;
    // If an image was uploaded, track it
    if (result.imageUrl && result.imageUrl.startsWith("upload:")) {
      const imageId = result.imageUrl.slice(7);
      setUploadedImageId(imageId);
      getImageUrl(imageId).then((url) => {
        if (url) setUploadedImageUrl(url);
      });
    }
    // Open the add plant form
    openAddForm();
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

      const image = await uploadImage(file);
      const blobUrl = await getImageUrl(image.id);

      setUploadedImageId(image.id);
      setUploadedImageUrl(blobUrl);
      setPlantForm((prev) => ({
        ...prev,
        imageUrl: `upload:${image.id}`,
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
          <div className="flex items-center gap-2">
            <IdentifyPlantButton onClick={() => setShowIdentifyDialog(true)} />
            <Button onClick={openAddForm} size="sm" className="shrink-0">
              <Plus size={14} />
              <span className="hidden sm:inline">Add Plant</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Filter row – scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-surface-container-high px-2.5 py-1.5 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            aria-label={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
          >
            {viewMode === "grid" ? <List size={14} aria-hidden="true" /> : <LayoutGrid size={14} aria-hidden="true" />}
            <span className="hidden sm:inline">
              {viewMode === "grid" ? "List" : "Grid"}
            </span>
          </button>
          <button
            onClick={() => setNeedsCareFilter(!needsCareFilter)}
            aria-pressed={needsCareFilter}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              needsCareFilter
                ? "bg-amber-500/20 text-amber-400"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            Needs Care
          </button>
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
            <MapPin size={10} className="inline mr-0.5" aria-hidden="true" />
            Location
          </button>
          <button
            onClick={() =>
              setTagFilter(tagFilter ? null : tags[0]?.id ?? null)
            }
            aria-pressed={!!tagFilter}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              tagFilter
                ? "bg-purple-500/20 text-purple-400"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
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
          <Sprout size={40} className="mb-3 text-on-surface-variant/30" />
          <p className="text-sm font-medium text-on-surface-variant">
            No plants found
          </p>
          <p className="text-xs text-on-surface-variant/50">
            Try adjusting your search or filters
          </p>
          <Button onClick={openAddForm} className="mt-4" size="sm">
            <Plus size={14} />
            Add Your First Plant
          </Button>
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
                onEdit={() => openEditForm(plant)}
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
                onQuickWater={() => logQuickCare(plant.id, "water")}
                onQuickFertilize={() => logQuickCare(plant.id, "fertilize")}
                onOpenDetail={() => {
                  setSelectedPlantId(plant.id);
                  setOpenDetail(true);
                }}
                onEdit={() => openEditForm(plant)}
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
          {selectedPlant && (
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
              onQuickWater={() => logQuickCare(selectedPlant.id, "water")}
              onQuickFertilize={() =>
                logQuickCare(selectedPlant.id, "fertilize")
              }
              onEdit={() => {
                setOpenDetail(false);
                openEditForm(selectedPlant);
              }}
              onDelete={() => handleDeletePlant(selectedPlant.id)}
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
                    <span className="text-[9px] text-on-surface-variant/40">
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
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-110"
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
  onQuickWater: () => void;
  onQuickFertilize: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
            <button
              onClick={onEdit}
              className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
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
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: tag.color + "20",
                  color: tag.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button onClick={onQuickWater} className="flex-1" size="sm">
          <Droplets size={14} />
          Log Water
        </Button>
        <Button
          onClick={onQuickFertilize}
          className="flex-1"
          size="sm"
          variant="secondary"
        >
          <FlaskConical size={14} />
          Log Fertilize
        </Button>
      </div>

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
      return <Droplets {...props} className="shrink-0 text-blue-400" />;
    case "fertilize":
      return <FlaskConical {...props} className="shrink-0 text-emerald-400" />;
    case "repot":
      return <RotateCcw {...props} className="shrink-0 text-amber-400" />;
    case "prune":
      return <Scissors {...props} className="shrink-0 text-purple-400" />;
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
      <span className="sm:hidden">Scan</span>
    </button>
  );
}
