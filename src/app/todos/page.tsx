"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Bell,
  BellOff,
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
import {
  addTodo as addTodoDb,
  updateTodo as updateTodoDb,
  deleteTodo as deleteTodoDb,
} from "@/lib/db";
import { generateId, formatDate, formatDateShort } from "@/lib/utils";
import type { Todo } from "@/lib/db";

const categoryLabels: Record<string, string> = {
  general: "General",
  watering: "Watering",
  planting: "Planting",
  harvesting: "Harvesting",
  maintenance: "Maintenance",
};

const categoryEmojis: Record<string, string> = {
  general: "📋",
  watering: "💧",
  planting: "🌱",
  harvesting: "🌾",
  maintenance: "🔧",
};

const categoryColors: Record<string, string> = {
  general: "text-sky-400",
  watering: "text-blue-400",
  planting: "text-emerald-400",
  harvesting: "text-amber-400",
  maintenance: "text-violet-400",
};

const categoryBgColors: Record<string, string> = {
  general: "bg-sky-500/10",
  watering: "bg-blue-500/10",
  planting: "bg-emerald-500/10",
  harvesting: "bg-amber-500/10",
  maintenance: "bg-violet-500/10",
};

type StatusFilter = "all" | "active" | "completed";

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

const categories = ["general", "watering", "planting", "harvesting", "maintenance"] as const;

export default function TodosPage() {
  usePageTitle("Todo Lists");
  const todos = useAppStore((s) => s.todos);
  const addTodoToStore = useAppStore((s) => s.addTodo);
  const updateTodoInStore = useAppStore((s) => s.updateTodo);
  const removeTodoFromStore = useAppStore((s) => s.removeTodo);
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general" as Todo["category"],
    date: "",
    time: "",
    reminderEnabled: false,
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({
      title: "",
      description: "",
      category: "general",
      date: "",
      time: "",
      reminderEnabled: false,
    });
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (todo: Todo) => {
    setEditing(todo);
    setForm({
      title: todo.title,
      description: todo.description,
      category: todo.category,
      date: todo.date,
      time: todo.time,
      reminderEnabled: todo.reminderEnabled,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;

    if (editing) {
      const updated: Todo = {
        ...editing,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        date: form.date,
        time: form.time,
        reminderEnabled: form.reminderEnabled,
      };
      await updateTodoDb(updated);
      updateTodoInStore(updated);
    } else {
      const newTodo: Todo = {
        id: generateId(),
        userId: currentUserId ?? "",
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        date: form.date,
        time: form.time,
        reminderEnabled: form.reminderEnabled,
        completed: false,
        notificationSent: false,
        createdAt: new Date().toISOString().split("T")[0],
      };
      await addTodoDb(newTodo);
      addTodoToStore(newTodo);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteTodoDb(id);
    removeTodoFromStore(id);
    setConfirmDelete(null);
  };

  const handleToggleComplete = async (todo: Todo) => {
    const updated: Todo = { ...todo, completed: !todo.completed };
    await updateTodoDb(updated);
    updateTodoInStore(updated);
  };

  const filteredTodos = useMemo(() => {
    let list = todos;

    // status filter
    if (statusFilter === "active") {
      list = list.filter((t) => !t.completed);
    } else if (statusFilter === "completed") {
      list = list.filter((t) => t.completed);
    }

    // category filter
    if (categoryFilter) {
      list = list.filter((t) => t.category === categoryFilter);
    }

    // sort: active first, then by createdAt desc
    return [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [todos, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of todos) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }, [todos]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            {todos.filter((t) => !t.completed).length} of {todos.length} tasks remaining
          </p>
        </div>
        <Button onClick={openAddForm} size="sm">
          <Plus size={14} />
          Add Todo
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1.5">
        {statusFilters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            aria-pressed={statusFilter === key}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === key
                ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/30"
                : "bg-surface-container/50 text-on-surface-variant/60 hover:bg-surface-container-high"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategoryFilter(null)}
          aria-pressed={categoryFilter === null}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
            categoryFilter === null
              ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/30"
              : "bg-surface-container/50 text-on-surface-variant/60 hover:bg-surface-container-high"
          }`}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            aria-pressed={categoryFilter === cat}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
              categoryFilter === cat
                ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] ring-1 ring-[var(--theme-primary)]/30"
                : "bg-surface-container/50 text-on-surface-variant/60 hover:bg-surface-container-high"
            }`}
          >
            <span>{categoryEmojis[cat]}</span>
            {categoryLabels[cat]}
            <span className="tabular-nums text-on-surface-variant/40">({stats[cat] || 0})</span>
          </button>
        ))}
      </div>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckSquare size={40} className="mb-3 text-on-surface-variant/30" />
          <p className="text-sm font-medium text-on-surface-variant">
            No to-do items found
          </p>
          <p className="mt-1 text-xs text-on-surface-variant/50">
            {statusFilter !== "all" || categoryFilter
              ? "Try adjusting your filters"
              : "Add your first task to get started"}
          </p>
          {statusFilter === "all" && !categoryFilter && (
            <Button onClick={openAddForm} className="mt-4" size="sm">
              <Plus size={14} />
              Add Todo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredTodos.map((todo, i) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.02 }}
                layout
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleComplete(todo)}
                        aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                          todo.completed
                            ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-[var(--theme-onPrimary)]"
                            : "border-outline/40 hover:border-[var(--theme-primary)]/60"
                        }`}
                      >
                        {todo.completed && <CheckSquare size={12} />}
                      </button>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-sm font-semibold transition-all ${
                              todo.completed
                                ? "text-on-surface-variant/50 line-through"
                                : "text-on-surface"
                            }`}
                          >
                            {todo.title}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${categoryBgColors[todo.category]} ${categoryColors[todo.category]}`}
                          >
                            {categoryLabels[todo.category]}
                          </span>
                        </div>

                        {/* Date, Time, Reminder */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                          {todo.date && (
                            <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/60">
                              <Calendar size={11} />
                              {formatDateShort(new Date(todo.date))}
                            </span>
                          )}
                          {todo.time && (
                            <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/60">
                              <Clock size={11} />
                              {todo.time}
                            </span>
                          )}
                          {todo.reminderEnabled && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
                              <Bell size={11} />
                              Reminder set
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {todo.description && (
                          <p
                            className={`mt-1.5 text-[10px] leading-relaxed line-clamp-2 ${
                              todo.completed
                                ? "text-on-surface-variant/40"
                                : "text-on-surface-variant/70"
                            }`}
                          >
                            {todo.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEditForm(todo)}
                          className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(todo.id)}
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
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Todo" : "New Todo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Title *"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Water the tomatoes, Prune rose bushes..."
            />

            <div>
              <label htmlFor="note-todos" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Description
              </label>
              <textarea
                id="note-todos"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Any additional details..."
                className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
                rows={2}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Category
              </label>
              <Select
                value={form.category}
                onValueChange={(val: Todo["category"]) =>
                  setForm((p) => ({ ...p, category: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        <span>{categoryEmojis[cat]}</span>
                        {categoryLabels[cat]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Time"
                  type="time"
                  value={form.time}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, time: e.target.value }))
                  }
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setForm((p) => ({ ...p, reminderEnabled: !p.reminderEnabled }))
              }
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                form.reminderEnabled
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-outline/30 bg-surface-container/60 text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {form.reminderEnabled ? (
                <Bell size={16} />
              ) : (
                <BellOff size={16} />
              )}
              {form.reminderEnabled ? "Reminder Enabled" : "Enable Reminder"}
            </button>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!form.title.trim()}>
                {editing ? "Save Changes" : "Add Todo"}
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
            <DialogTitle>Delete Todo?</DialogTitle>
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
