"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Check, CalendarDays, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, X, Repeat,
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
import { computeNextDate, getRepeatLabel } from "@/lib/repeat-utils";

type ActionItem = import("@/lib/db").ActionItem;
type Plant = import("@/lib/db").Plant;
type ActionRepeat = import("@/lib/db").ActionRepeat;
type RepeatConfig = import("@/lib/db").RepeatConfig;

export default function CalendarPage() {
  usePageTitle("Calendar");

  const plants = useAppStore((s) => s.plants);
  const actionItems = useAppStore((s) => s.actionItems);
  const currentUserId = useAppStore((s) => s.currentUserId);

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => today.toISOString().split("T")[0], [today]);
  const [viewDate, setViewDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const selectedDateStr = useMemo(() => {
    if (selectedDay === null) return null;
    return new Date(year, month, selectedDay).toISOString().split("T")[0];
  }, [selectedDay, year, month]);

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

  const goToday = () => { setViewDate(today); setSelectedDay(null); };
  const prevMonth = () => { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null); };

  const getActionsForDay = useCallback(
    (day: number) => {
      const dateStr = new Date(year, month, day).toISOString().split("T")[0];
      return actionItems.filter((a) => a.date?.startsWith(dateStr));
    },
    [actionItems, year, month]
  );

  const filteredActions = useMemo(() => {
    let items = actionItems;
    // Filter by selected day if one is chosen
    if (selectedDateStr) {
      items = items.filter((a) => a.date?.startsWith(selectedDateStr));
    }
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
  }, [actionItems, filterStatus, filterType, selectedDateStr]);

  const actionTypes = useMemo(
    () => [...new Set(actionItems.map((a) => a.type).filter(Boolean))] as string[],
    [actionItems]
  );

  const resetForm = () => {
    setEditingAction(null);
    setShowForm(false);
    setSaveError(null);
  };

  const openAddForm = (date = todayIso) => {
    setSaveError(null);
    setEditingAction(null);
    setFormTitle("");
    setFormType("water");
    setFormDate(date);
    setFormTime("");
    setFormNote("");
    setFormPlantId("none");
    setFormRepeat("none");
    setFormRepeatConfig({});
    setShowForm(true);
  };

  const openEditForm = (action: ActionItem) => {
    setSaveError(null);
    setEditingAction(action);
    setShowForm(true);
  };

  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("water");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formPlantId, setFormPlantId] = useState("none");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Repeat scheduling state
  const [formRepeat, setFormRepeat] = useState<ActionRepeat>("none");
  const [formRepeatConfig, setFormRepeatConfig] = useState<RepeatConfig>({});

  // Helper to merge partial RepeatConfig updates
  const updateRepeatConfig = useCallback((patch: Partial<RepeatConfig>) => {
    setFormRepeatConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const nextDuePreview = useMemo(() => {
    if (formRepeat === "none" || !formDate) return null;
    if (formRepeat === "dynamic") {
      const days = formRepeatConfig.intervalDays ?? 1;
      return `Next: ${days} day${days !== 1 ? "s" : ""} after completion`;
    }
    const nextDate = computeNextDate(formRepeat, formRepeatConfig, formDate);
    if (!nextDate) return null;
    return `Next: ${new Date(nextDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  }, [formRepeat, formRepeatConfig, formDate]);

  useEffect(() => {
    if (editingAction) {
      setFormTitle(editingAction.title);
      setFormType(editingAction.type || "water");
      setFormDate(editingAction.date?.substring(0, 10) || "");
      setFormTime(editingAction.time || "");
      setFormNote(editingAction.note || "");
      setFormPlantId((editingAction.plantIds?.[0]) || "none");
      setFormRepeat(editingAction.repeat || "none");
      setFormRepeatConfig(editingAction.repeatConfig || {});
    }
  }, [editingAction]);

  const saveAction = async () => {
    if (!formTitle.trim()) return;
    if (!currentUserId) {
      setSaveError("You must be logged in to save actions.");
      return;
    }
    if (!formDate) {
      setSaveError("Please select a date before saving.");
      return;
    }
    setSaveError(null);
    try {
      const action: ActionItem = {
        id: editingAction?.id || generateId(),
        userId: editingAction?.userId || currentUserId,
        title: formTitle.trim(),
        source: editingAction?.source || ("manual" as const),
        type: formType as ActionItem["type"],
        date: formDate,
        time: formTime,
        completed: editingAction?.completed || false,
        plantIds: formPlantId && formPlantId !== "none" ? [formPlantId] : [],
        plantNames: formPlantId && formPlantId !== "none"
          ? [plants.find((p) => p.id === formPlantId)?.name || ""]
          : [],
        note: formNote,
        repeat: formRepeat,
        repeatConfig: formRepeatConfig,
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to save action:", msg, error);
      setSaveError(`An unexpected error occurred. Please try again.`);
    }
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
                      setSelectedDay(selectedDay === day ? null : day);
                    }}
                    onDoubleClick={() => {
                      const ds = new Date(year, month, day).toISOString().split("T")[0];
                      openAddForm(ds);
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg p-1.5 min-h-[48px] text-xs transition-colors",
                      "hover:bg-surface-container-high/60",
                      isToday(day) && !(selectedDay === day) && "ring-1 ring-[var(--theme-primary)]/30 bg-[var(--theme-primary)]/5",
                      selectedDay === day && "ring-2 ring-[var(--theme-primary)] bg-[var(--theme-primary)]/10"
                    )}
                  >
                    <span className={cn(
                      "font-medium",
                      isToday(day) && "text-[var(--theme-primary)]",
                      selectedDay === day && "text-[var(--theme-primary)]"
                    )}>
                      {day}
                    </span>
                    {hasActions && (
                      <div className="flex gap-0.5 absolute bottom-1">
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
              <h2 className="text-sm font-bold text-on-surface">
                {selectedDateStr ? (
                  <span>Actions — {new Date(selectedDateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                ) : (
                  "Actions"
                )}
              </h2>
              <div className="flex items-center gap-1">
                {selectedDateStr && (
                  <Button onClick={() => setSelectedDay(null)} size="sm" variant="ghost" className="text-xs">
                    <X size={12} className="mr-0.5" /> Show all
                  </Button>
                )}
                <Button onClick={() => openAddForm(selectedDateStr ?? undefined)} size="sm">
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>
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
                      {action.repeat && action.repeat !== "none" && (
                        <span className="px-1 py-0.5 rounded bg-surface-container-high/40 text-[10px] flex items-center gap-0.5">
                          <Repeat size={8} />
                          {getRepeatLabel(action.repeat, action.repeatConfig || {})}
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
                  <SelectItem value="none">None</SelectItem>
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

            {/* Repeat Scheduling */}
            <div className="space-y-3 pt-1 border-t border-outline-variant/30">
              <div className="flex items-center gap-2 pt-1">
                <Repeat size={14} className="text-[var(--theme-primary)]/60" />
                <span className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
                  Repeat
                </span>
              </div>

              <Select value={formRepeat} onValueChange={(v) => {
                setFormRepeat(v as ActionRepeat);
                setFormRepeatConfig({});
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Never" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Never</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="dynamic">Dynamic (after completion)</SelectItem>
                </SelectContent>
              </Select>

              {/* Daily: every X days */}
              {formRepeat === "daily" && (
                <Input
                  label="Every X day(s)"
                  type="number"
                  min={1}
                  value={String(formRepeatConfig.intervalDays ?? 1)}
                  onChange={(e) => updateRepeatConfig({ intervalDays: Math.max(1, parseInt(e.target.value) || 1) })}
                  placeholder="1"
                />
              )}

              {/* Weekly */}
              {formRepeat === "weekly" && (
                <div className="space-y-2">
                  <Input
                    label="Every X week(s)"
                    type="number"
                    min={1}
                    value={String(formRepeatConfig.intervalWeeks ?? 1)}
                    onChange={(e) => updateRepeatConfig({ intervalWeeks: Math.max(1, parseInt(e.target.value) || 1) })}
                    placeholder="1"
                  />
                  <div>
                    <label className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-1.5 block">
                      Repeat on
                    </label>
                    <div className="flex gap-1">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name, idx) => {
                        const selected = formRepeatConfig.weekdays?.includes(idx) ?? false;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const current = formRepeatConfig.weekdays ?? [];
                              const next = selected
                                ? current.filter((d) => d !== idx)
                                : [...current, idx].sort();
                              updateRepeatConfig({ weekdays: next.length > 0 ? next : undefined });
                            }}
                            className={cn(
                              "w-8 h-8 rounded-lg text-[10px] font-semibold transition-colors",
                              selected
                                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                                : "bg-surface-container-high/40 text-on-surface-variant/60 hover:text-on-surface"
                            )}
                          >
                            {name[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly */}
              {formRepeat === "monthly" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateRepeatConfig({ monthlyMode: "dayOfMonth" })}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors",
                        (formRepeatConfig.monthlyMode ?? "dayOfMonth") === "dayOfMonth"
                          ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                          : "bg-surface-container-high/40 text-on-surface-variant/60 hover:text-on-surface"
                      )}
                    >
                      Day of month
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRepeatConfig({ monthlyMode: "nthWeekday" })}
                      className={cn(
                        "flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors",
                        formRepeatConfig.monthlyMode === "nthWeekday"
                          ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                          : "bg-surface-container-high/40 text-on-surface-variant/60 hover:text-on-surface"
                      )}
                    >
                      Nth weekday
                    </button>
                  </div>

                  {(formRepeatConfig.monthlyMode ?? "dayOfMonth") === "dayOfMonth" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Day of month"
                        type="number"
                        min={1}
                        max={31}
                        value={String(formRepeatConfig.dayOfMonth ?? 1)}
                        onChange={(e) => updateRepeatConfig({ dayOfMonth: Math.max(1, Math.min(31, parseInt(e.target.value) || 1)) })}
                        placeholder="1"
                      />
                      <Input
                        label="Every X month(s)"
                        type="number"
                        min={1}
                        value={String(formRepeatConfig.intervalMonths ?? 1)}
                        onChange={(e) => updateRepeatConfig({ intervalMonths: Math.max(1, parseInt(e.target.value) || 1) })}
                        placeholder="1"
                      />
                    </div>
                  )}

                  {formRepeatConfig.monthlyMode === "nthWeekday" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-1.5 block">
                          Ordinal
                        </label>
                        <Select
                          value={String(formRepeatConfig.nth ?? 0)}
                          onValueChange={(v) => updateRepeatConfig({ nth: v === "last" ? "last" : parseInt(v) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">First</SelectItem>
                            <SelectItem value="1">Second</SelectItem>
                            <SelectItem value="2">Third</SelectItem>
                            <SelectItem value="3">Fourth</SelectItem>
                            <SelectItem value="last">Last</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant mb-1.5 block">
                          Weekday
                        </label>
                        <Select
                          value={String(formRepeatConfig.weekday ?? 0)}
                          onValueChange={(v) => updateRepeatConfig({ weekday: parseInt(v) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sunday</SelectItem>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Yearly */}
              {formRepeat === "yearly" && (
                <Input
                  label="Every X year(s)"
                  type="number"
                  min={1}
                  value={String(formRepeatConfig.intervalYears ?? 1)}
                  onChange={(e) => updateRepeatConfig({ intervalYears: Math.max(1, parseInt(e.target.value) || 1) })}
                  placeholder="1"
                />
              )}

              {/* Dynamic */}
              {formRepeat === "dynamic" && (
                <Input
                  label="Repeat X days after completion"
                  type="number"
                  min={1}
                  value={String(formRepeatConfig.intervalDays ?? 1)}
                  onChange={(e) => updateRepeatConfig({ intervalDays: Math.max(1, parseInt(e.target.value) || 1), dynamicAfterCompletion: true })}
                  placeholder="1"
                />
              )}

              {/* Active Months toggle */}
              {formRepeat !== "none" && (
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(formRepeatConfig.activeMonths || formRepeatConfig.dormantMonths)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateRepeatConfig({ dormantMonths: [] });
                        } else {
                          updateRepeatConfig({ activeMonths: undefined, dormantMonths: undefined });
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-outline/30 bg-surface-container/60 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]/30"
                    />
                    <span className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
                      Only repeat in specific months
                    </span>
                  </label>

                  {!!(formRepeatConfig.activeMonths || formRepeatConfig.dormantMonths) && (
                    <div>
                      <label className="text-[10px] font-medium text-on-surface-variant/70 block mb-1">
                        Skip these months
                      </label>
                      <p className="text-[10px] text-on-surface-variant/50 mb-2">
                        If the next due date falls in a skipped month, it will advance to the next available month.
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((name, idx) => {
                          const monthNum = idx + 1;
                          const dormant = formRepeatConfig.dormantMonths?.includes(monthNum) ?? false;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const current = formRepeatConfig.dormantMonths ?? [];
                                const next = dormant
                                  ? current.filter((m) => m !== monthNum)
                                  : [...current, monthNum].sort((a, b) => a - b);
                                updateRepeatConfig({ dormantMonths: next });
                              }}
                              className={cn(
                                "px-1 py-1 rounded text-[10px] font-medium transition-colors",
                                dormant
                                  ? "bg-red-500/15 text-red-500"
                                  : "bg-surface-container-high/40 text-on-surface-variant/60 hover:text-on-surface"
                              )}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Next Due Preview */}
            {nextDuePreview && (
              <div className="rounded-xl bg-[var(--theme-primary)]/5 px-3 py-2 text-xs text-[var(--theme-primary)] flex items-center gap-2">
                <Repeat size={12} />
                <span>{nextDuePreview}</span>
              </div>
            )}

            {saveError && (
              <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
                Something went wrong. {saveError}
              </div>
            )}
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
