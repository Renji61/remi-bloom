"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  LeafyGreen,
  Wrench,
  Box,
  Upload,
  X,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { useFormatPrice } from "@/hooks/use-currency";
import {
  addInventoryItem,
  updateInventoryItem as updateInventoryItemDb,
  deleteInventoryItem as deleteInventoryItemDb,
  uploadImage,
  getImageUrl,
  deleteUploadedImage,
} from "@/lib/db";
import { SafeImage } from "@/components/ui/safe-image";
import { generateId, formatDate } from "@/lib/utils";
import type { InventoryItem } from "@/lib/db";

const categoryIcons: Record<string, React.ReactNode> = {
  supply: <Box size={14} />,
  seed: <LeafyGreen size={14} />,
  tool: <Wrench size={14} />,
  other: <Package size={14} />,
};

const categoryLabels: Record<string, string> = {
  supply: "Supplies",
  seed: "Seeds",
  tool: "Tools",
  other: "Other",
};

const categoryEmojis: Record<string, string> = {
  supply: "📦",
  seed: "🌱",
  tool: "🔧",
  other: "📁",
};

export default function InventoryPage() {
  usePageTitle("Inventory");
  const items = useAppStore((s) => s.inventoryItems);
  const addItemToStore = useAppStore((s) => s.addInventoryItem);
  const updateItemInStore = useAppStore((s) => s.updateInventoryItem);
  const removeItemFromStore = useAppStore((s) => s.removeInventoryItem);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const formatPrice = useFormatPrice();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "supply" as InventoryItem["category"],
    quantity: 1,
    unit: "",
    price: 0,
    notes: "",
    imageUrl: "",
  });
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Thumbnail cache: map of imageId -> blob URL for card display
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const loadThumbnail = useCallback(async (imageId: string) => {
    if (thumbnails[imageId]) return;
    const url = await getImageUrl(imageId);
    if (url) {
      setThumbnails((prev) => ({ ...prev, [imageId]: url }));
    }
  }, [thumbnails]);

  // Load thumbnails in a separate effect (not inside useMemo)
  useEffect(() => {
    for (const item of items) {
      if (item.imageUrl && item.imageUrl.startsWith("upload:")) {
        const imageId = item.imageUrl.slice(7);
        loadThumbnail(imageId);
      }
    }
  }, [items, loadThumbnail]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.notes.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      list = list.filter((it) => it.category === categoryFilter);
    }
    return list;
  }, [items, debouncedSearch, categoryFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) {
      counts[it.category] = (counts[it.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({
      name: "",
      category: "supply",
      quantity: 1,
      unit: "",
      price: 0,
      notes: "",
      imageUrl: "",
    });
    setUploadedImageId(null);
    setUploadedImageUrl(null);
    setUploadError(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setForm({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price ?? 0,
      notes: item.notes,
      imageUrl: item.imageUrl,
    });
    if (item.imageUrl && item.imageUrl.startsWith("upload:")) {
      const imageId = item.imageUrl.slice(7);
      setUploadedImageId(imageId);
      getImageUrl(imageId).then((url) => {
        if (url) setUploadedImageUrl(url);
      });
    }
    setEditing(item);
    setShowForm(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      // Clean up previous uploaded image if replacing
      if (uploadedImageId) {
        await deleteUploadedImage(uploadedImageId);
        if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      }

      const image = await uploadImage(file);
      const blobUrl = await getImageUrl(image.id);

      setUploadedImageId(image.id);
      setUploadedImageUrl(blobUrl);
      setForm((p) => ({
        ...p,
        imageUrl: `upload:${image.id}`,
      }));
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
    setForm((p) => ({ ...p, imageUrl: "" }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    if (editing) {
      const updated: InventoryItem = {
        ...editing,
        name: form.name.trim(),
        category: form.category,
        quantity: form.quantity,
        unit: form.unit.trim(),
        price: form.price,
        notes: form.notes.trim(),
        imageUrl: form.imageUrl.trim(),
      };
      await updateInventoryItemDb(updated);
      updateItemInStore(updated);
    } else {
      const newItem: InventoryItem = {
        id: generateId(),
        userId: currentUserId ?? "",
        name: form.name.trim(),
        category: form.category,
        quantity: form.quantity,
        unit: form.unit.trim(),
        price: form.price,
        notes: form.notes.trim(),
        imageUrl: form.imageUrl.trim(),
        createdAt: new Date().toISOString().split("T")[0],
      };
      await addInventoryItem(newItem);
      addItemToStore(newItem);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    // Clean up uploaded image if present
    const item = items.find((it) => it.id === id);
    if (item?.imageUrl && item.imageUrl.startsWith("upload:")) {
      const imageId = item.imageUrl.slice(7);
      await deleteUploadedImage(imageId);
      // Revoke any cached blob URL
      if (thumbnails[imageId]) {
        URL.revokeObjectURL(thumbnails[imageId]);
      }
    }
    await deleteInventoryItemDb(id);
    removeItemFromStore(id);
    setConfirmDelete(null);
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      setThumbnails((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            {items.length} items tracked
          </p>
        </div>
        <Button onClick={openAddForm} size="sm">
          <Plus size={14} />
          Add Item
        </Button>
      </div>

      {/* Category Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(categoryLabels).map(([key, label]) => {
          const count = stats[key] || 0;
          const active = categoryFilter === key;
          return (
            <button
              key={key}
              onClick={() =>
                setCategoryFilter(active ? null : key)
              }
              className={`flex flex-col items-center gap-1 rounded-2xl p-3 transition-all ${
                active
                  ? "bg-[var(--theme-primary)]/10 ring-1 ring-[var(--theme-primary)]/30"
                  : "bg-surface-container/50 hover:bg-surface-container-high"
              }`}
            >
              <span className="text-lg">{categoryEmojis[key]}</span>
              <span
                className={`text-[10px] font-semibold ${
                  active ? "text-[var(--theme-primary)]" : "text-on-surface-variant"
                }`}
              >
                {label}
              </span>
              <span className="text-[18px] font-bold tabular-nums text-on-surface-variant/40">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <Input
        placeholder="Search inventory by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Item Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package size={40} className="mb-3 text-on-surface-variant/30" />
          <p className="text-sm font-medium text-on-surface-variant">
            No inventory items found
          </p>
          <p className="mt-1 text-xs text-on-surface-variant/50">
            {search || categoryFilter
              ? "Try adjusting your search or filters"
              : "Add your first item to start tracking supplies"}
          </p>
          {!search && !categoryFilter && (
            <Button onClick={openAddForm} className="mt-4" size="sm">
              <Plus size={14} />
              Add Item
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, i) => {
              const isUploadedImage = item.imageUrl && item.imageUrl.startsWith("upload:");
              const imageId = isUploadedImage ? item.imageUrl.slice(7) : null;
              const thumbnailUrl = imageId ? thumbnails[imageId] : null;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail or Emoji icon */}
                        {thumbnailUrl || (item.imageUrl && !isUploadedImage) ? (
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-surface-container-high">
                            <SafeImage
                              src={thumbnailUrl || item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-xl">
                            {categoryEmojis[item.category]}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-on-surface truncate">
                            {item.name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                              {categoryLabels[item.category]}
                            </span>
                            <span className="text-[18px] font-bold tabular-nums text-[var(--theme-primary)]">
                              {item.quantity}
                            </span>
                            {item.unit && (
                              <span className="text-[10px] text-on-surface-variant/60">
                                {item.unit}
                              </span>
                            )}
                            {(item.price ?? 0) > 0 && (
                              <span className="text-[11px] font-semibold tabular-nums text-emerald-400">
                                {formatPrice(item.price) || `$${(item.price ?? 0).toFixed(2)}`}
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="mt-1.5 text-[10px] text-on-surface-variant/70 leading-relaxed line-clamp-2">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => openEditForm(item)}
                            className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(item.id)}
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
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Item" : "New Inventory Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Item Name *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Potting Soil, Pruning Shears..."
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Category
              </label>
              <div className="flex gap-2">
                {(["supply", "seed", "tool", "other"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm((p) => ({ ...p, category: cat }))}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-3 text-xs font-semibold transition-all ${
                      form.category === cat
                        ? "bg-[var(--theme-primary)]/20 ring-1 ring-[var(--theme-primary)] text-[var(--theme-primary)]"
                        : "bg-surface-container-high text-on-surface-variant/60 hover:bg-surface-container-higher"
                    }`}
                  >
                    <span className="text-lg">{categoryEmojis[cat]}</span>
                    {categoryLabels[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  label="Quantity *"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      quantity: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Unit"
                  value={form.unit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, unit: e.target.value }))
                  }
                  placeholder="e.g. bags, pieces, seeds"
                />
              </div>
            </div>

            {/* Price Field */}
            <div>
              <Input
                label="Price"
                type="number"
                min={0}
                step={0.01}
                value={form.price || ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    price: Math.max(0, parseFloat(e.target.value) || 0),
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="note-inventory" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Notes
              </label>
              <textarea
                id="note-inventory"
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Any additional details..."
                className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
                rows={2}
              />
            </div>

            {/* Photo URL */}
            <Input
              label="Photo URL"
              value={!uploadedImageId ? form.imageUrl : ""}
              onChange={(e) => {
                if (uploadedImageId) removeUploadedImage();
                setForm((p) => ({ ...p, imageUrl: e.target.value }));
              }}
              placeholder="https://example.com/item.jpg"
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
                aria-label="Upload inventory item image"
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
                <span className="text-[10px] text-on-surface-variant/40">
                  JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF (max 10MB)
                </span>
              </div>

              {/* Upload Error */}
              {uploadError && (
                <p className="mt-1.5 text-[11px] text-red-400">{uploadError}</p>
              )}

              {/* Uploaded Image Preview */}
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
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform hover:scale-110"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || form.quantity < 0}>
                {editing ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Inventory Item?</DialogTitle>
          </DialogHeader>
          <DialogDescription>This action cannot be undone.</DialogDescription>
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
