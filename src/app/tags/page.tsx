"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  Sprout,
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
import { addTag, deleteTag, updateTag } from "@/lib/db";
import { getUserSetting, setUserSetting } from "@/lib/db";
import { generateId, cn } from "@/lib/utils";
import type { Tag } from "@/lib/db";

const tagColors = [
  "#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#fbbf24",
  "#fb923c", "#2dd4bf", "#f87171", "#e879f9", "#facc15",
  "#a3e635", "#84cc16", "#22d3ee", "#c084fc", "#f59e0b",
];

export default function TagsPage() {
  usePageTitle("Tags");
  const tags = useAppStore((s) => s.tags);
  const plants = useAppStore((s) => s.plants);
  const addTagToStore = useAppStore((s) => s.addTag);
  const updateTagInStore = useAppStore((s) => s.updateTag);
  const removeTagFromStore = useAppStore((s) => s.removeTag);
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [showForm, setShowForm] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#60a5fa");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Count plants per tag
  const plantCountByTag = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const plant of plants) {
      if (plant.tags) {
        for (const tagId of plant.tags) {
          counts[tagId] = (counts[tagId] || 0) + 1;
        }
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
        getUserSetting(currentUserId, "tagsSortKey"),
        getUserSetting(currentUserId, "tagsSortDirection"),
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
    setUserSetting(currentUserId, "tagsSortKey", sortKey);
    setUserSetting(currentUserId, "tagsSortDirection", sortDirection);
  }, [sortKey, sortDirection, currentUserId, sortLoaded]);

  // Sorted tags
  const sortedTags = useMemo(() => {
    const sorted = [...tags];
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
  }, [tags, sortKey, sortDirection]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    if (editTag) {
      const updated: Tag = {
        ...editTag,
        name: name.trim(),
        color,
      };
      await updateTag(updated);
      updateTagInStore(updated);
    } else {
      const newTag: Tag = {
        id: generateId(),
        userId: currentUserId ?? "",
        name: name.trim(),
        color,
        createdAt: new Date().toISOString().split("T")[0],
      };
      await addTag(newTag);
      addTagToStore(newTag);
    }

    resetForm();
  };

  const handleEdit = (tag: Tag) => {
    setEditTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const tag = tags.find((t) => t.id === id);
    await deleteTag(id);
    removeTagFromStore(id);
    setConfirmDelete(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditTag(null);
    setName("");
    setColor("#60a5fa");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            {tags.length} tags —{" "}
            {plants.filter((p) => p.tags && p.tags.length > 0).length} plants tagged
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
          <Plus size={14} />
          Add Tag
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

      {/* Tag Grid */}
      {tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Tags size={40} className="mb-3 text-on-surface-variant/50" />
          <p className="text-sm font-medium text-on-surface-variant">
            No tags yet
          </p>
          <p className="mt-1 text-xs text-on-surface-variant/50">
            Create your first tag to categorize your plants
          </p>
          <Button onClick={() => setShowForm(true)} className="mt-4" size="sm">
            <Plus size={14} />
            Create Tag
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {sortedTags.map((tag, i) => (
              <motion.div
                key={tag.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                layout
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
                        style={{ backgroundColor: `${tag.color}20` }}
                      >
                        <div
                          className="h-6 w-6 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-on-surface truncate">
                          {tag.name}
                        </h3>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Sprout size={10} className="text-[var(--theme-primary)]/60" />
                          <span className="text-[10px] text-on-surface-variant/60">
                            {plantCountByTag[tag.id] || 0} plants
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(tag)}
                          className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(tag.id)}
                          className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTag ? "Edit Tag" : "New Tag"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Color Picker */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Color
              </label>
                  <div className="flex flex-wrap gap-2">
                {tagColors.map((c) => {
                  // Determine brightness for checkmark contrast
                  const hex = c.replace("#", "");
                  const r = parseInt(hex.substring(0, 2), 16);
                  const g = parseInt(hex.substring(2, 4), 16);
                  const b = parseInt(hex.substring(4, 6), 16);
                  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                  const isLight = brightness > 128;
                  return (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                        color === c
                          ? "ring-2 ring-white/60 scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    >
                      {color === c && (
                        <span
                          className={`text-[10px] drop-shadow ${
                            isLight ? "text-black/70" : "text-white"
                          }`}
                        >✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Tag Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Low Light, Pet Friendly..."
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!name.trim()}>
                {editTag ? "Save Changes" : "Create Tag"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Plants tagged with this tag will have it removed. This action
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
