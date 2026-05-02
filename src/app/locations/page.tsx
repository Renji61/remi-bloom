"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Sprout,
  Upload,
  X,
  ArrowUpDown,
  CalendarDays,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
} from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import {
  addLocation,
  deleteLocation,
  updateLocation,
  uploadImage,
  getImageUrl,
  deleteUploadedImage,
} from "@/lib/db";
import { SafeImage } from "@/components/ui/safe-image";
import { generateId, cn } from "@/lib/utils";
import type { PlantLocation } from "@/lib/db";
import { getUserSetting, setUserSetting } from "@/lib/db";

const locationEmojis = ["🛋️", "🍳", "🌤️", "🛏️", "🚿", "💼", "🚪", "🏡", "🌿", "☀️", "🌙", "🏠"];

export default function LocationsPage() {
  usePageTitle("Plant Locations");
  const locations = useAppStore((s) => s.locations);
  const plants = useAppStore((s) => s.plants);
  const addLocationToStore = useAppStore((s) => s.addLocation);
  const removeLocationFromStore = useAppStore((s) => s.removeLocation);
  const updateLocationInStore = useAppStore((s) => s.updateLocation);
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [showForm, setShowForm] = useState(false);
  const [editLocation, setEditLocation] = useState<PlantLocation | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🛋️");
  const [imageUrl, setImageUrl] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Image upload state
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Thumbnail cache
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  // Load thumbnails for existing uploaded images
  useEffect(() => {
    const pending: string[] = [];
    for (const loc of locations) {
      if (loc.imageUrl && loc.imageUrl.startsWith("upload:")) {
        const imageId = loc.imageUrl.slice(7);
        if (!thumbnails[imageId]) pending.push(imageId);
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
        setThumbnails((prev) => ({ ...prev, ...updates }));
      }
    });
  }, [locations]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(thumbnails).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Count plants per location
  const plantCountByLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const plant of plants) {
      if (plant.locationId) {
        counts[plant.locationId] = (counts[plant.locationId] || 0) + 1;
      }
    }
    return counts;
  }, [plants]);

  // Sort state
  const [sortKey, setSortKey] = useState<"createdAt" | "name">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [sortLoaded, setSortLoaded] = useState(false);

  // Load saved sort preferences
  useEffect(() => {
    async function loadSort() {
      if (!currentUserId) return;
      const [key, dir] = await Promise.all([
        getUserSetting(currentUserId, "locationsSortKey"),
        getUserSetting(currentUserId, "locationsSortDirection"),
      ]);
      if (key === "createdAt" || key === "name") setSortKey(key);
      if (dir === "asc" || dir === "desc") setSortDirection(dir);
      setSortLoaded(true);
    }
    loadSort();
  }, [currentUserId]);

  // Save sort preferences when they change
  useEffect(() => {
    if (!currentUserId || !sortLoaded) return;
    setUserSetting(currentUserId, "locationsSortKey", sortKey);
    setUserSetting(currentUserId, "locationsSortDirection", sortDirection);
  }, [sortKey, sortDirection, currentUserId, sortLoaded]);

  // Sorted locations
  const sortedLocations = useMemo(() => {
    const sorted = [...locations];
    sorted.sort((a, b) => {
      let cmp: number;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      }
      if (cmp === 0) {
        cmp = a.name.localeCompare(b.name);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [locations, sortKey, sortDirection]);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      if (uploadedImageId) {
        await deleteUploadedImage(uploadedImageId);
        if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      }

      const imageUrl = await uploadImage(file);

      setUploadedImageId(imageUrl);
      setUploadedImageUrl(imageUrl);
      setImageUrl(imageUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeUploadedImage = () => {
    if (uploadedImageId) {
      deleteUploadedImage(uploadedImageId);
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
    }
    setUploadedImageId(null);
    setUploadedImageUrl(null);
    setImageUrl("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    if (editLocation) {
      const updated: PlantLocation = {
        ...editLocation,
        name: name.trim(),
        description: description.trim(),
        emoji,
        imageUrl: imageUrl.trim(),
      };
      await updateLocation(updated);
      updateLocationInStore(updated);
    } else {
      const newLocation: PlantLocation = {
        id: generateId(),
        userId: currentUserId ?? "",
        name: name.trim(),
        description: description.trim(),
        emoji,
        imageUrl: imageUrl.trim(),
        createdAt: new Date().toISOString().split("T")[0],
      };
      await addLocation(newLocation);
      addLocationToStore(newLocation);
    }

    resetForm();
  };

  const handleEdit = (loc: PlantLocation) => {
    setEditLocation(loc);
    setName(loc.name);
    setDescription(loc.description);
    setEmoji(loc.emoji);
    setImageUrl(loc.imageUrl);
    if (loc.imageUrl && loc.imageUrl.startsWith("upload:")) {
      const imageId = loc.imageUrl.slice(7);
      setUploadedImageId(imageId);
      getImageUrl(imageId).then((url) => {
        if (url) setUploadedImageUrl(url);
      });
    }
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const loc = locations.find((l) => l.id === id);
    if (loc?.imageUrl && loc.imageUrl.startsWith("upload:")) {
      const imageId = loc.imageUrl.slice(7);
      await deleteUploadedImage(imageId);
      if (thumbnails[imageId]) {
        URL.revokeObjectURL(thumbnails[imageId]);
      }
    }
    await deleteLocation(id);
    removeLocationFromStore(id);
    setConfirmDelete(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditLocation(null);
    setName("");
    setDescription("");
    setEmoji("🛋️");
    setImageUrl("");
    removeUploadedImage();
  };

  const getLocationThumbnail = (loc: PlantLocation): string | null => {
    if (loc.imageUrl && loc.imageUrl.startsWith("upload:")) {
      const imageId = loc.imageUrl.slice(7);
      return thumbnails[imageId] ?? null;
    }
    if (loc.imageUrl && !loc.imageUrl.startsWith("upload:")) {
      return loc.imageUrl;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            {locations.length} locations —{" "}
            {plants.filter((p) => p.locationId).length} plants assigned
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
          <Plus size={14} />
          Add Location
        </Button>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex gap-1 rounded-lg bg-surface-container-high/40 p-0.5">
          <button
            onClick={() => {
              if (sortKey !== "name") {
                setSortKey("name");
                setSortDirection("asc");
              } else {
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
              }
            }}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors flex items-center gap-1",
              sortKey === "name"
                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                : "text-on-surface-variant/60 hover:text-on-surface"
            )}
          >
            <ArrowUpDown size={12} aria-hidden="true" />
            Name
            <span className="text-[9px]">
              {sortKey === "name" ? (sortDirection === "asc" ? "A→Z" : "Z→A") : ""}
            </span>
          </button>
          <button
            onClick={() => {
              if (sortKey !== "createdAt") {
                setSortKey("createdAt");
                setSortDirection("desc");
              } else {
                setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
              }
            }}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors flex items-center gap-1",
              sortKey === "createdAt"
                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                : "text-on-surface-variant/60 hover:text-on-surface"
            )}
          >
            <CalendarDays size={12} aria-hidden="true" />
            {sortKey === "createdAt" ? (sortDirection === "desc" ? "Newest" : "Oldest") : "Date"}
            <span className="text-[9px]">
              {sortKey === "createdAt" ? (sortDirection === "desc" ? "↓" : "↑") : ""}
            </span>
          </button>
        </div>
      </div>

      {/* Location Grid */}
      {locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MapPin size={40} className="mb-3 text-on-surface-variant/50" />
          <p className="text-sm font-medium text-on-surface-variant">
            No locations yet
          </p>
          <p className="mt-1 text-xs text-on-surface-variant/50">
            Create your first location to organize your plants
          </p>
          <Button
            onClick={() => setShowForm(true)}
            className="mt-4"
            size="sm"
          >
            <Plus size={14} />
            Create Location
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {sortedLocations.map((loc, i) => {
              const thumbnail = getLocationThumbnail(loc);
              return (
                <motion.div
                  key={loc.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {thumbnail ? (
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-surface-container-high">
                            <SafeImage
                              src={thumbnail ?? ""}
                              alt={loc.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-xl">
                            {loc.emoji}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-on-surface truncate">
                            {loc.name}
                          </h3>
                          {loc.description && (
                            <p className="mt-0.5 text-[11px] text-on-surface-variant/70 leading-relaxed line-clamp-2">
                              {loc.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-1.5">
                            <Sprout size={10} className="text-[var(--theme-primary)]/60" />
                            <span className="text-[10px] text-on-surface-variant/60">
                              {plantCountByLocation[loc.id] || 0} plants
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(loc)}
                            className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(loc.id)}
                            className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editLocation ? "Edit Location" : "New Location"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Emoji Picker */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {locationEmojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all ${
                      emoji === e
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
              label="Location Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Living Room, Balcony..."
            />
            <div>
              <label htmlFor="note-locations" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Description
              </label>
              <textarea
                id="note-locations"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Bright indirect light near the east window"
                className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
                rows={2}
              />
            </div>

            {/* Photo URL */}
            <Input
              label="Photo URL"
              value={imageUrl.startsWith("upload:") ? "" : imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                if (uploadedImageId) removeUploadedImage();
              }}
              placeholder="https://example.com/photo.jpg"
            />

            {/* Image Upload */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Or Upload an Image
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,image/tiff"
                className="hidden"
                onChange={handleFileUpload}
                aria-label="Upload location image"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 rounded-2xl border border-dashed border-outline/30 bg-surface-container/30 px-4 py-3 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container/60 hover:border-[var(--theme-primary)]/30"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Choose Image
                    </>
                  )}
                </button>
                <span className="text-[10px] text-on-surface-variant/50">
                  JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF (max 10MB)
                </span>
              </div>

              {uploadError && (
                <p className="mt-1.5 text-[11px] text-red-400">{uploadError}</p>
              )}

              {uploadedImageUrl && (
                <div className="relative mt-3 inline-block">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl bg-surface-container-high">
                    <SafeImage
                      src={uploadedImageUrl}
                      alt="Uploaded preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={removeUploadedImage}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-110"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!name.trim()}>
                {editLocation ? "Save Changes" : "Create Location"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Plants assigned to this location will be unassigned. This action
            cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
