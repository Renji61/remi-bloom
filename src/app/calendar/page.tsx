"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Check, CalendarDays, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import {
  Button, Card, CardContent,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { addActionItem, updateActionItem, deleteActionItem } from "@/lib/db";
import { generateId, cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";

type ActionItem = import("@/lib/db").ActionItem;
type Plant = import("@/lib/db").Plant;

export default function CalendarPage() {
  usePageTitle("Calendar");

  const plants = useAppStore((s) => s.plants);
  const actionItems = useAppStore((s) => s.actionItems);
  const currentUserId = useAppStore((s) => s.currentUserId);

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => today.toISOString().split("T")[0], [today]);
  const [viewDate, setViewDate] = useState(today);
  const [showForm, setShowForm] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const isToday = (d: number) => {
    const c = new Date();
    return d === c.getDate() && month === c.getMonth() && year === c.getFullYear();
  };

  const goToday = () => setViewDate(today);
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const getActionsForDay = useCallback(
    (day: number) => {
      const dateStr = new Date(year, month, day).toISOString().split("T")[0];
      return actionItems.filter((a) => a.date?.startsWith(dateStr));
    },
    [actionItems, year, month]
  );

  const filteredActions = useMemo(() => {
    let items = actionItems;
    if (filterStatus === "pending") items = items.filter((a) => !a.completed);
    else if (filterStatus === "completed") items = items.filter((a) => a.completed);
    if (filterType !== "all") items = items.filter((a) => a.type === filterType);
    const sorted = [...items].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
    sorted.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
    return sorted;
  }, [actionItems, filterStatus, filterType]);

  const actionTypes = useMemo(
    () => [...new Set(actionItems.map((a) => a.type).filter(Boolean))] as string[],
    [actionItems]
  );

  const resetForm = () => {
    setEditingAction(null);
    setShowForm(false);
  };

  const openAddForm = (date = todayIso) => {
    setEditingAction(null);
    setFormTitle("");
    setFormType("water");
    setFormDate(date);
    setFormTime("");
    setFormNote("");
    setFormPlantId("");
    setShowForm(true);
  };

  const openEditForm = (action: ActionItem) => {
    setEditingAction(action);
    setShowForm(true);
  };

  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("water");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formPlantId, setFormPlantId] = useState("");

  useEffect(() => {
    if (editingAction) {
      setFormTitle(editingAction.title);
      setFormType(editingAction.type || "water");
      setFormDate(editingAction.date?.split("T")[0] || "");
      setFormTime(editingAction.time || "");
      setFormNote(editingAction.note || "");
      setFormPlantId((editingAction.plantIds?.[0]) || "");
    }
  }, [editingAction]);

  const saveAction = async () => {
    if (!formTitle.trim()) return;
    const action: ActionItem = {
      id: editingAction?.id || generateId(),
      userId: editingAction?.userId || currentUserId || "",
      title: formTitle.trim(),
      source: editingAction?.source || ("manual" as const),
      type: formType as ActionItem["type"],
      date: formDate,
      time: formTime,
      completed: editingAction?.completed || false,
      plantIds: formPlantId ? [formPlantId] : [],
      plantNames: formPlantId
        ? [plants.find((p) => p.id === formPlantId)?.name || ""]
        : [],
      note: formNote,
      repeat: editingAction?.repeat || ("none" as const),
      repeatConfig: editingAction?.repeatConfig ?? { type: "none" } as import("@/lib/db").RepeatConfig,
      snoozedUntil: editingAction?.snoozedUntil || null,
      category: editingAction?.category || (formType as ActionItem["category"]),
      createdAt: editingAction?.createdAt || new Date().toISOString(),
    };
    if (editingAction) {
      await updateActionItem(action);
    } else {
      await addActionItem(action);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteActionItem(id);
    setDeleteConfirm(null);
  };

  const toggleComplete = async (action: ActionItem) => {
    await updateActionItem({ ...action, completed: !action.completed });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-on-surface">
                {monthNames[month]} {year}
              </h2>
              <div className="flex items-center gap-1">
                <Button onClick={prevMonth} size="sm" variant="ghost">
                  <ChevronLeft size={16} />
                </Button>
                <Button onClick={goToday} size="sm" variant="ghost" className="text-xs">
                  Today
                </Button>
                <Button onClick={nextMonth} size="sm" variant="ghost">
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-on-surface-variant/60 py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />;
                const dayActions = getActionsForDay(day);
                const overdue = dayActions.some(
                  (a) => !a.completed && a.date && new Date(a.date) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                );
                const hasActions = dayActions.length > 0;
                const allDone = hasActions && dayActions.every((a) => a.completed);
                return (
                  <button
                    key={`d-${day}`}
                    onClick={() => {
                      const ds = new Date(year, month, day).toISOString().split("T")[0];
                      openAddForm(ds);
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-start rounded-lg p-1.5 min-h-[48px] text-xs transition-colors",
                      "hover:bg-surface-container-high/60",
                      isToday(day) && "ring-1 ring-[var(--theme-primary)]/30 bg-[var(--theme-primary)]/5"
                    )}
                  >
                    <span className={cn("font-medium", isToday(day) && "text-[var(--theme-primary)]")}>
                      {day}
                    </span>
                    {hasActions && (
                      <div className="flex gap-0.5 mt-0.5">
                        {allDone ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ) : overdue ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)]" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface">Actions</h2>
              <Button onClick={() => openAddForm()} size="sm">
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(["all", "pending", "completed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-medium transition-colors",
                    filterStatus === s
                      ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                      : "bg-surface-container-high/40 text-on-surface-variant/60 hover:text-on-surface"
                  )}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              {actionTypes.length > 0 && (
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-[10px] bg-surface-container-high/40 rounded-lg px-2 py-1 text-on-surface-variant border-0 outline-none"
                >
                  <option value="all">All Types</option>
                  {actionTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredActions.length === 0 && (
                <p className="text-xs text-on-surface-variant/40 text-center py-8">
                  No actions found
                </p>
              )}
              {filteredActions.map((action) => (
                <div
                  key={action.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg transition-colors group",
                    "hover:bg-surface-container-high/40",
                    action.completed && "opacity-50"
                  )}
                >
                  <button
                    onClick={() => toggleComplete(action)}
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      action.completed
                        ? "bg-emerald-400 border-emerald-400 text-white"
                        : "border-on-surface-variant/30 hover:border-[var(--theme-primary)]"
                    )}
                  >
                    {action.completed && <Check size={10} strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium text-on-surface truncate", action.completed && "line-through")}>
                      {action.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/50">
                      {action.date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays size={10} />
                          {new Date(action.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {action.type && (
                        <span className="px-1 py-0.5 rounded bg-surface-container-high/40 capitalize">
                          {action.type}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditForm(action)} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant/60">
                      <Pencil size={12} />
                    </button>
                    {deleteConfirm === action.id ? (
                      <button onClick={() => handleDelete(action.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400">
                        <Trash2 size={12} />
                      </button>
                    ) : (
                      <button onClick={() => setDeleteConfirm(action.id)} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant/60">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingAction ? "Edit Action" : "New Action"}</DialogTitle>
            <DialogDescription>
              {editingAction ? "Update this care action" : "Add a new care action to your schedule"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Action Name"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Water the roses"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                  Type
                </label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["water", "fertilize", "prune", "repot", "harvesting", "clean", "mist", "general"].map((t) => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace("-", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                label="Date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <Input
              label="Time (optional)"
              type="time"
              value={formTime}
              onChange={(e) => setFormTime(e.target.value)}
            />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                Related Plant (optional)
              </label>
              <Select value={formPlantId} onValueChange={setFormPlantId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.emoji} {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5 block">
                Note (optional)
              </label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Add any notes..."
                rows={2}
                className="w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all duration-200 focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={resetForm} size="sm" variant="ghost">Cancel</Button>
              <Button onClick={saveAction} size="sm" disabled={!formTitle.trim()}>
                {editingAction ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
