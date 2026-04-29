"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Droplets,
  FlaskConical,
  Scissors,
  RefreshCw,
  Sprout,
  Sparkles,
  User,
  CalendarDays,
  Clock,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import {
  updateActionItem,
  deleteActionItem,
  updateReminder,
  deleteReminder,
  deleteTodo,
} from "@/lib/db";
import { formatDate } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: "action" | "reminder" | "todo";
  title: string;
  date: string;
  time: string;
  completed: boolean;
  sourceLabel: string;
  category: string;
  note: string;
  plantNames: string[];
  createdAt: string;
  snoozedUntil: string | null;
  repeat: string;
};

export default function NotificationsPage() {
  usePageTitle("Notifications");
  const actionItems = useAppStore((s) => s.actionItems);
  const reminders = useAppStore((s) => s.reminders);
  const todos = useAppStore((s) => s.todos);
  const removeActionItem = useAppStore((s) => s.removeActionItem);
  const updateActionItemInStore = useAppStore((s) => s.updateActionItem);
  const removeReminder = useAppStore((s) => s.removeReminder);
  const removeTodo = useAppStore((s) => s.removeTodo);

  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];

    // Action items (uncompleted or snoozed)
    for (const a of actionItems) {
      const isOverdue = a.date < new Date().toISOString().split("T")[0] && !a.completed;
      const isSnoozed = a.snoozedUntil && new Date(a.snoozedUntil) > new Date();
      if (!a.completed || isOverdue || isSnoozed) {
        items.push({
          id: `action:${a.id}`,
          type: "action",
          title: a.title,
          date: a.date,
          time: a.time,
          completed: a.completed,
          sourceLabel: a.source === "system" ? "Auto" : "Manual",
          category: a.category,
          note: a.note,
          plantNames: a.plantNames,
          createdAt: a.createdAt,
          snoozedUntil: a.snoozedUntil,
          repeat: a.repeat,
        });
      }
    }

    // Reminders
    for (const r of reminders) {
      if (!r.completed) {
        items.push({
          id: `reminder:${r.id}`,
          type: "reminder",
          title: r.title,
          date: r.date,
          time: r.time,
          completed: r.completed,
          sourceLabel: "Reminder",
          category: r.type,
          note: r.note,
          plantNames: r.plantName ? [r.plantName] : [],
          createdAt: r.createdAt,
          snoozedUntil: null,
          repeat: r.repeat,
        });
      }
    }

    // Todos
    for (const t of todos) {
      if (!t.completed) {
        items.push({
          id: `todo:${t.id}`,
          type: "todo",
          title: t.title,
          date: t.date,
          time: t.time,
          completed: t.completed,
          sourceLabel: "Todo",
          category: t.category,
          note: t.description,
          plantNames: [],
          createdAt: t.createdAt,
          snoozedUntil: null,
          repeat: "none",
        });
      }
    }

    // Sort by date (most recent first), then by creation time
    items.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });

    // Apply filter
    if (filter === "pending") return items.filter((i) => !i.completed);
    if (filter === "completed") return items.filter((i) => i.completed);
    return items;
  }, [actionItems, reminders, todos, filter]);

  const handleComplete = async (item: NotificationItem) => {
    if (item.type === "action") {
      const origId = item.id.replace("action:", "");
      await updateActionItem({ ...actionItems.find((a) => a.id === origId)!, completed: true, snoozedUntil: null });
      updateActionItemInStore({ ...actionItems.find((a) => a.id === origId)!, completed: true, snoozedUntil: null });
    } else if (item.type === "reminder") {
      const origId = item.id.replace("reminder:", "");
      await updateReminder({ ...reminders.find((r) => r.id === origId)!, completed: true });
      removeReminder(origId);
    } else if (item.type === "todo") {
      const origId = item.id.replace("todo:", "");
      await deleteTodo(origId);
      removeTodo(origId);
    }
  };

  const handleDelete = async (itemId: string) => {
    const [type, origId] = itemId.split(":");
    if (type === "action") {
      await deleteActionItem(origId);
      removeActionItem(origId);
    } else if (type === "reminder") {
      await deleteReminder(origId);
      removeReminder(origId);
    } else if (type === "todo") {
      await deleteTodo(origId);
      removeTodo(origId);
    }
    setConfirmDelete(null);
  };

  const getTypeIcon = (item: NotificationItem) => {
    const props = { size: 14 };
    switch (item.type) {
      case "action":
        return item.sourceLabel === "Auto"
          ? <Sparkles {...props} className="text-[var(--theme-primary)]" />
          : <User {...props} className="text-on-surface-variant" />;
      case "reminder":
        return <Bell {...props} className="text-amber-400" />;
      case "todo":
        return <Clock {...props} className="text-blue-400" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "water": return "text-blue-400";
      case "fertilize": return "text-emerald-400";
      case "prune": return "text-purple-400";
      case "repot": return "text-amber-400";
      default: return "text-on-surface-variant";
    }
  };

  const getCategoryIcon = (category: string) => {
    const props = { size: 12 };
    switch (category) {
      case "water": return <Droplets {...props} className="text-blue-400" />;
      case "fertilize": return <FlaskConical {...props} className="text-emerald-400" />;
      case "prune": return <Scissors {...props} className="text-purple-400" />;
      case "repot": return <RefreshCw {...props} className="text-amber-400" />;
      default: return <Bell {...props} className="text-on-surface-variant" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            {notifications.length} pending
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-high">
          <Bell size={18} className="text-[var(--theme-primary)]" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["pending", "all", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              filter === f
                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {f === "pending" ? "Pending" : f === "all" ? "All" : "Completed"}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BellOff size={40} className="mb-3 text-on-surface-variant/30" />
          <p className="text-sm font-medium text-on-surface-variant">
            All caught up!
          </p>
          <p className="mt-1 text-xs text-on-surface-variant/50">
            No pending notifications
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {notifications.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: 100 }}
                transition={{ delay: i * 0.02 }}
                layout
                className={`group relative rounded-2xl p-3 sm:p-4 transition-all ${
                  item.completed
                    ? "bg-surface-container/20 opacity-60"
                    : "bg-surface-container/40 hover:bg-surface-container/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    item.type === "action" && item.sourceLabel === "Auto"
                      ? "bg-[var(--theme-primary)]/10"
                      : "bg-surface-container-high"
                  }`}>
                    {getTypeIcon(item)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={getCategoryColor(item.category)}>
                            {getCategoryIcon(item.category)}
                          </span>
                          <h3 className={`text-sm font-semibold truncate ${
                            item.completed ? "text-on-surface-variant/50" : "text-on-surface"
                          }`}>
                            {item.title}
                          </h3>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-[10px] text-on-surface-variant/50">
                            <CalendarDays size={10} className="inline mr-0.5" />
                            {formatDate(new Date(item.date))}
                            {item.time && ` ${item.time}`}
                          </span>
                          {item.plantNames.length > 0 && (
                            <span className="text-[10px] text-on-surface-variant/50">
                              {item.plantNames.join(", ")}
                            </span>
                          )}
                          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${
                            item.sourceLabel === "Auto"
                              ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]"
                              : item.sourceLabel === "Reminder"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-blue-500/10 text-blue-400"
                          }`}>
                            {item.sourceLabel}
                          </span>
                        </div>
                        {item.note && (
                          <p className="mt-1 text-[10px] text-on-surface-variant/60 leading-relaxed line-clamp-2">
                            {item.note}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        {!item.completed && (
                          <button
                            onClick={() => handleComplete(item)}
                            className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            aria-label="Mark complete"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(item.id)}
                          className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Notification?</DialogTitle>
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
