"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Plus, Pencil, Trash2, Check, X } from "lucide-react";
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
import {
  addReminder,
  updateReminder as updateReminderDb,
  deleteReminder as deleteReminderDb,
} from "@/lib/db";
import { generateId, formatDateShort } from "@/lib/utils";
import type { Reminder, ReminderType } from "@/lib/db";

function tabIcon(tab: FilterTab): string {
  if (tab === "all") return "📋";
  if (tab === "upcoming") return "🔔";
  if (tab === "completed") return "✅";
  const icons: Record<ReminderType, string> = {
    water: "💧",
    fertilize: "🧪",
    mist: "🌊",
    repot: "🪴",
    clean: "🧹",
    seed: "🌱",
    transplant: "🌿",
    other: "📋",
  };
  return icons[tab] || "📋";
}

function tabLabel(tab: FilterTab): string {
  if (tab === "all") return "All";
  if (tab === "upcoming") return "Upcoming";
  if (tab === "completed") return "Completed";
  const labels: Record<ReminderType, string> = {
    water: "Water",
    fertilize: "Fertilize",
    mist: "Mist",
    repot: "Repot",
    clean: "Clean",
    seed: "Seed",
    transplant: "Transplant",
    other: "Other",
  };
  return labels[tab] || tab;
}

const typeIcons: Record<ReminderType, string> = {
  water: "💧",
  fertilize: "🧪",
  mist: "🌊",
  repot: "🪴",
  clean: "🧹",
  seed: "🌱",
  transplant: "🌿",
  other: "📋",
};

const typeLabels: Record<ReminderType, string> = {
  water: "Water",
  fertilize: "Fertilize",
  mist: "Mist",
  repot: "Repot",
  clean: "Clean",
  seed: "Seed",
  transplant: "Transplant",
  other: "Other",
};

const repeatLabels: Record<string, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  custom: "Custom",
};

const typeOptions: ReminderType[] = [
  "water",
  "fertilize",
  "mist",
  "repot",
  "clean",
  "seed",
  "transplant",
  "other",
];

type FilterTab = "all" | "upcoming" | "completed" | ReminderType;

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const defaultReminder: Omit<Reminder, "id" | "createdAt"> = {
  title: "",
  userId: "",
  plantId: null,
  plantName: "",
  type: "water",
  date: getTodayString(),
  time: "09:00",
  repeat: "none",
  repeatInterval: 1,
  note: "",
  completed: false,
};

export default function RemindersPage() {
  usePageTitle("Smart Reminders");
  const { reminders, plants, addReminder: addToStore, updateReminder: updateInStore, removeReminder } = useAppStore();
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [form, setForm] = useState<Omit<Reminder, "id" | "createdAt">>({ ...defaultReminder });

  // Seed sample reminders if store is empty
  useMemo(() => {
    if (reminders.length > 0) return;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const inTwoWeeks = new Date(today);
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const sample: Reminder[] = [
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Water the Monstera",
        plantId: null,
        plantName: "Monstera Deliciosa",
        type: "water",
        date: fmt(today),
        time: "08:00",
        repeat: "weekly",
        repeatInterval: 1,
        note: "Water thoroughly until it drains from the bottom. Let soil dry slightly between waterings.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Fertilize Snake Plant",
        plantId: null,
        plantName: "Snake Plant",
        type: "fertilize",
        date: fmt(today),
        time: "10:00",
        repeat: "monthly",
        repeatInterval: 1,
        note: "Use diluted liquid fertilizer at half strength.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Mist Ferns",
        plantId: null,
        plantName: "Boston Fern",
        type: "mist",
        date: fmt(today),
        time: "07:30",
        repeat: "daily",
        repeatInterval: 1,
        note: "Mist in the morning so leaves dry before evening.",
        completed: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Repot Pothos",
        plantId: null,
        plantName: "Golden Pothos",
        type: "repot",
        date: fmt(tomorrow),
        time: "14:00",
        repeat: "none",
        repeatInterval: 1,
        note: "Move to a pot 2 inches larger. Use well-draining potting mix.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Clean Plant Leaves",
        plantId: null,
        plantName: "Rubber Plant",
        type: "clean",
        date: fmt(tomorrow),
        time: "11:00",
        repeat: "biweekly",
        repeatInterval: 1,
        note: "Wipe leaves gently with a damp cloth to remove dust.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Start Basil Seeds",
        plantId: null,
        plantName: "",
        type: "seed",
        date: fmt(nextWeek),
        time: "09:00",
        repeat: "none",
        repeatInterval: 1,
        note: "Sow seeds 1/4 inch deep in seed-starting mix. Keep moist and warm.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Transplant Tomato Seedlings",
        plantId: null,
        plantName: "Cherry Tomato",
        type: "transplant",
        date: fmt(inTwoWeeks),
        time: "16:00",
        repeat: "none",
        repeatInterval: 1,
        note: "Harden off seedlings before transplanting outdoors.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Water Succulents",
        plantId: null,
        plantName: "Echeveria",
        type: "water",
        date: fmt(today),
        time: "18:00",
        repeat: "custom",
        repeatInterval: 14,
        note: "Bottom water only when soil is completely dry.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Fertilize Orchid",
        plantId: null,
        plantName: "Phalaenopsis Orchid",
        type: "fertilize",
        date: fmt(nextWeek),
        time: "08:30",
        repeat: "monthly",
        repeatInterval: 1,
        note: "Use orchid-specific fertilizer. Water first, then fertilize.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        userId: currentUserId ?? "",
        title: "Mist Air Plants",
        plantId: null,
        plantName: "Tillandsia",
        type: "mist",
        date: fmt(today),
        time: "06:00",
        repeat: "daily",
        repeatInterval: 1,
        note: "Mist thoroughly, ensuring good air circulation afterward.",
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ];

    Promise.all(
      sample.map((r) => {
        addToStore(r);
        return addReminder(r).catch(() => {});
      })
    );
  }, []);

  const filteredReminders = useMemo(() => {
    const todayStr = getTodayString();
    let list = reminders;

    if (activeFilter === "upcoming") {
      list = list.filter((r) => !r.completed && r.date >= todayStr);
    } else if (activeFilter === "completed") {
      list = list.filter((r) => r.completed);
    } else if (activeFilter !== "all") {
      list = list.filter((r) => r.type === activeFilter);
    }

    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    });
  }, [reminders, activeFilter]);

  const filterTabs = useMemo(() => {
    const base: FilterTab[] = ["all", "upcoming", "completed"];
    const seen = new Set<FilterTab>();
    reminders.forEach((r) => {
      if (!seen.has(r.type)) {
        seen.add(r.type);
        base.push(r.type);
      }
    });
    return base;
  }, [reminders]);

  function openAdd() {
    setEditingReminder(null);
    setForm({ ...defaultReminder });
    setShowAddDialog(true);
  }

  function openEdit(r: Reminder) {
    setEditingReminder(r);
    setForm({
      userId: r.userId,
      title: r.title,
      plantId: r.plantId,
      plantName: r.plantName,
      type: r.type,
      date: r.date,
      time: r.time,
      repeat: r.repeat,
      repeatInterval: r.repeatInterval,
      note: r.note,
      completed: r.completed,
    });
    setShowAddDialog(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;

    if (editingReminder) {
      const updated: Reminder = {
        ...editingReminder,
        ...form,
      };
      updateInStore(updated);
      await updateReminderDb(updated).catch(() => {});
    } else {
      const newReminder: Reminder = {
        id: generateId(),
        ...form,
        userId: form.userId || (currentUserId ?? ""),
        createdAt: new Date().toISOString(),
      };
      addToStore(newReminder);
      await addReminder(newReminder).catch(() => {});
    }

    setShowAddDialog(false);
    setEditingReminder(null);
  }

  function confirmDelete(r: Reminder) {
    setDeleteTarget(r);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    removeReminder(deleteTarget.id);
    await deleteReminderDb(deleteTarget.id).catch(() => {});
    setDeleteTarget(null);
  }

  async function toggleComplete(r: Reminder) {
    const updated: Reminder = { ...r, completed: !r.completed };
    updateInStore(updated);
    await updateReminderDb(updated).catch(() => {});
  }

  const completedCount = reminders.filter((r) => r.completed).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            {reminders.length} reminder{reminders.length !== 1 ? "s" : ""}
            {completedCount > 0 && ` · ${completedCount} completed`}
          </p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus size={14} className="mr-1" />
          Add Reminder
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            aria-pressed={activeFilter === tab}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              activeFilter === tab
                ? "bg-[var(--theme-primary)]/20 ring-1 ring-[var(--theme-primary)]/30 text-[var(--theme-primary)]"
                : "bg-surface-container/50 text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface-variant"
            }`}
          >
            {tabIcon(tab)} {tabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filteredReminders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell size={40} className="mb-3 text-on-surface-variant/30" />
          <p className="text-sm font-medium text-on-surface-variant">
            {activeFilter === "all"
              ? "No reminders yet"
              : `No ${tabLabel(activeFilter).toLowerCase()} reminders`}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant/50">
            {activeFilter === "all"
              ? "Create your first reminder to stay on top of plant care"
              : "Try a different filter or create a new reminder"}
          </p>
        </div>
      )}

      {/* Reminder Grid */}
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredReminders.map((reminder, i) => (
            <motion.div
              key={reminder.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.01 }}
              layout
            >
              <Card
                className={`transition-all duration-200 ${
                  reminder.completed ? "opacity-50" : ""
                }`}
              >
                <CardContent className="p-4">
                  {/* Top row: type icon + title + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => toggleComplete(reminder)}
                        aria-label={reminder.completed ? "Mark as incomplete" : "Mark as complete"}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                          reminder.completed
                            ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-surface"
                            : "border-outline/30 hover:border-[var(--theme-primary)]/50"
                        }`}
                      >
                        {reminder.completed && <Check size={12} />}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg" title={typeLabels[reminder.type]}>
                            {typeIcons[reminder.type]}
                          </span>
                          <h3
                            className={`truncate text-sm font-semibold ${
                              reminder.completed
                                ? "text-on-surface-variant/50 line-through"
                                : "text-on-surface"
                            }`}
                          >
                            {reminder.title}
                          </h3>
                        </div>
                        {reminder.plantName && (
                          <p className="mt-0.5 truncate text-xs text-on-surface-variant/60">
                            {reminder.plantName}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant/50">
                          <span>
                            {formatDateShort(new Date(reminder.date))}
                          </span>
                          <span className="text-outline/30">·</span>
                          <span>{reminder.time}</span>
                          {reminder.repeat !== "none" && (
                            <>
                              <span className="text-outline/30">·</span>
                              <span className="text-[var(--theme-primary)]/60">
                                {repeatLabels[reminder.repeat]}
                                {reminder.repeat === "custom" &&
                                  ` (every ${reminder.repeatInterval} days)`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => openEdit(reminder)}
                        className="rounded-lg p-1.5 text-on-surface-variant/60 transition-all duration-200 hover:bg-surface-container-high hover:text-on-surface-variant"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => confirmDelete(reminder)}
                        className="rounded-lg p-1.5 text-red-400/60 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Notes */}
                  {reminder.note && (
                    <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant/50 pl-9">
                      {reminder.note}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReminder ? "Edit Reminder" : "New Reminder"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Title
              </label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Water the Monstera"
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Type
              </label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as ReminderType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {typeIcons[t]} {typeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plant */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Plant (optional)
              </label>
              <Select
                value={form.plantId ?? "none"}
                onValueChange={(v) => {
                  const plant = plants.find((p) => p.id === v);
                  setForm({
                    ...form,
                    plantId: v === "none" ? null : v,
                    plantName: v === "none" ? "" : plant?.name ?? "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No plant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No plant</SelectItem>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Date
                </label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Time
                </label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>

            {/* Repeat */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Repeat
              </label>
              <Select
                value={form.repeat}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    repeat: v as Reminder["repeat"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom interval */}
            {form.repeat === "custom" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Repeat every (days)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={form.repeatInterval}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      repeatInterval: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label htmlFor="note-reminders" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Notes (optional)
              </label>
              <textarea
                id="note-reminders"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Any additional details…"
                rows={3}
                className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowAddDialog(false)}>
                <X size={14} className="mr-1" />
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!form.title.trim()}
              >
                <Check size={14} className="mr-1" />
                {editingReminder ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
          <DialogDescription>
            Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? This action cannot be undone.
          </DialogDescription>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                <X size={14} className="mr-1" />
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                <Trash2 size={14} className="mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
