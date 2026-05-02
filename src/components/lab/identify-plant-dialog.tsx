"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Leaf,
  FlaskConical,
  Upload,
  Camera,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Droplets,
  Sun,
  Package,
  RefreshCw,
  Sprout,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { CameraView } from "@/components/lab/camera-view";
import { IdentificationManager } from "@/lib/identification-manager";
import { uploadImage } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import type {
  IdentificationResult,
  CareScheduleSuggestion,
  FertilizerSuggestion,
  IdentificationProgress,
} from "@/lib/identification-manager";
import type { ActionItem, ActionType } from "@/lib/db";

export interface IdentifyResult {
  name: string;
  scientificName: string;
  description: string;
  imageUrl: string;
  careTasks: ActionItem[];
}

interface IdentifyPlantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: IdentifyResult) => void;
}

// --- Step indicator ---
function ScanningOverlay({
  progress,
  onCancel,
}: {
  progress: IdentificationProgress;
  onCancel: () => void;
}) {
  const steps = [
    "Step 1: Identifying species...",
    "Step 2: Retrieving expert care guides...",
    "Step 3: Setting up your care schedule...",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative overflow-hidden rounded-2xl bg-surface-container/80 p-8 text-center backdrop-blur-2xl"
    >
      <div className="mb-6 flex justify-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--theme-primary)]/10">
          <Sprout size={32} className="text-[var(--theme-primary)]" />
          <div className="absolute inset-0 animate-ping rounded-full border-2 border-[var(--theme-primary)]/30" />
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const isActive = progress.step === i + 1;
          const isDone = progress.step > i + 1;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all ${
                isActive
                  ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]"
                  : isDone
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-on-surface-variant/40"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-[var(--theme-primary)]/20"
                    : isDone
                      ? "bg-emerald-500/20"
                      : "bg-surface-container"
                }`}
              >
                {isDone ? <Check size={12} /> : i + 1}
              </div>
              <span>{step}</span>
              {isActive && (
                <div className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {isDone && <Check size={14} className="ml-auto" />}
            </div>
          );
        })}
      </div>

      <button
        onClick={onCancel}
        className="mt-6 text-[11px] text-on-surface-variant/50 underline underline-offset-2 hover:text-on-surface-variant transition-colors"
      >
        Cancel
      </button>
    </motion.div>
  );
}

// --- Manual name search fallback ---
function ManualNameSearch({
  onSelect,
  onBack,
}: {
  onSelect: (name: string, scientificName: string) => void;
  onBack: () => void;
}) {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ name: string; scientificName: string; thumbnailUrl?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const matches = await IdentificationManager.searchByName(query);
      setResults(matches);
      if (matches.length === 0) {
        setError("No matches found. Try a different name.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs text-on-surface-variant/50 underline underline-offset-2 hover:text-on-surface-variant">
          Back
        </button>
        <span className="text-xs text-on-surface-variant/50">/ Manual Search</span>
      </div>
      <p className="text-xs text-on-surface-variant/70">
        Could not identify the plant automatically. Search by name:
      </p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. Monstera deliciosa"
          className="flex-1 rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 backdrop-blur-sm transition-all focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20"
        />
        <Button onClick={handleSearch} disabled={searching || !query.trim()} size="sm">
          {searching ? "..." : <Search size={14} />}
        </Button>
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <div className="space-y-1.5">
        {results.map((r, i) => (
          <button
            key={i}
            onClick={() => onSelect(r.name, r.scientificName)}
            className="flex w-full items-center gap-3 rounded-xl bg-surface-container/60 px-4 py-3 text-left transition-all hover:bg-surface-container"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-primary)]/10">
              <Leaf size={18} className="text-[var(--theme-primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{r.name}</p>
              <p className="text-[10px] text-on-surface-variant/60 italic truncate">{r.scientificName}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// --- Confirm Identity screen ---
function ConfirmIdentityScreen({
  result,
  onConfirm,
  onSelectMatch,
  onCancel,
}: {
  result: IdentificationResult;
  onConfirm: (customName?: string, customSciName?: string, selectedIndexes?: number[]) => void;
  onSelectMatch: (name: string, sciName: string) => void;
  onCancel: () => void;
}) {
  const [editingName, setEditingName] = useState(result.species.name);
  const [editingSciName, setEditingSciName] = useState(result.species.scientificName);
  const totalTasks = result.careSchedules.length + result.fertilizers.filter((f) => !f.inStock).length;
  const [selectedTasks, setSelectedTasks] = useState<boolean[]>(() => Array(totalTasks).fill(true));

  const toggleTask = (index: number) => {
    setSelectedTasks((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const allSelected = selectedTasks.every(Boolean);
  const toggleAll = () => {
    setSelectedTasks(Array(totalTasks).fill(!allSelected));
  };

  const renderCareSchedule = (cs: CareScheduleSuggestion, index: number) => {
    const isSelected = selectedTasks[index];
    return (
      <button
        key={cs.type}
        onClick={() => toggleTask(index)}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-all ${
          isSelected
            ? "bg-surface-container/60"
            : "bg-surface-container/20 opacity-60"
        }`}
      >
        {cs.type === "water" && <Droplets size={14} className={isSelected ? "text-blue-400" : "text-on-surface-variant/40"} />}
        {cs.type === "fertilize" && <Sprout size={14} className={isSelected ? "text-emerald-400" : "text-on-surface-variant/40"} />}
        {cs.type === "prune" && <ScissorsIcon size={14} className={isSelected ? "text-purple-400" : "text-on-surface-variant/40"} />}
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold ${isSelected ? "text-on-surface" : "text-on-surface-variant/60"}`}>{cs.label}</p>
          <p className="text-[9px] text-on-surface-variant/60">Every {cs.frequencyDays} days</p>
        </div>
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
          isSelected
            ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white"
            : "border-outline/30 bg-transparent"
        }`}>
          {isSelected && <Check size={11} />}
        </div>
      </button>
    );
  };

  const renderFertilizerTask = (f: FertilizerSuggestion, index: number) => {
    const taskIndex = result.careSchedules.length + index;
    const isSelected = selectedTasks[taskIndex];
    return (
      <button
        key={`fert-${f.name}`}
        onClick={() => toggleTask(taskIndex)}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-all ${
          isSelected
            ? "bg-surface-container/40"
            : "bg-surface-container/20 opacity-60"
        }`}
      >
        <Package size={12} className={isSelected ? "text-on-surface-variant/50" : "text-on-surface-variant/20"} />
        <span className={`flex-1 text-[11px] ${isSelected ? "text-on-surface-variant" : "text-on-surface-variant/40"}`}>{f.name}</span>
        <span className="text-[9px] text-amber-400">Not in inventory</span>
        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
          isSelected
            ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white"
            : "border-outline/30 bg-transparent"
        }`}>
          {isSelected && <Check size={11} />}
        </div>
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Top match */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
              Top Match
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                result.species.confidence >= 80
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}
            >
              {result.species.confidence}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/10">
              <Leaf size={26} className="text-[var(--theme-primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-on-surface outline-none"
                placeholder="Plant name"
              />
              <input
                value={editingSciName}
                onChange={(e) => setEditingSciName(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-[11px] italic text-on-surface-variant/60 outline-none"
                placeholder="Scientific name"
              />
            </div>
          </div>

          {result.species.healthAssessment && (
            <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-surface-container/60 px-3 py-2">
              <FlaskConical size={12} className="text-[var(--theme-primary)]" />
              <span className="text-[10px] text-on-surface-variant">
                Health: {result.species.healthAssessment}
              </span>
            </div>
          )}

          {result.sunlightNeeds.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-surface-container/60 px-3 py-2">
              <Sun size={12} className="text-amber-400" />
              <span className="text-[10px] text-on-surface-variant">
                Light: {result.sunlightNeeds.join(", ")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other matches — always visible so the user can pick a different one */}
      {result.topMatches.length > 1 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Other Matches
          </h3>
          <div className="space-y-1.5">
            {result.topMatches.slice(1).map((m, i) => (
              <button
                key={i}
                onClick={() => onSelectMatch(m.name, m.scientificName)}
                className="flex w-full items-center gap-3 rounded-xl bg-surface-container/40 px-4 py-3 text-left transition-all hover:bg-surface-container"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high">
                  <Leaf size={16} className="text-on-surface-variant" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{m.name}</p>
                  <p className="text-[10px] text-on-surface-variant/60 italic">{m.scientificName}</p>
                </div>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-bold text-on-surface-variant/70">
                  {m.confidence}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle all / none */}
      {totalTasks > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAll}
            className="text-[10px] text-on-surface-variant/50 underline underline-offset-2 hover:text-on-surface-variant transition-colors"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-[9px] text-on-surface-variant/30">
            ({selectedTasks.filter(Boolean).length}/{totalTasks} selected)
          </span>
        </div>
      )}

      {/* Care schedule suggestions */}
      {result.careSchedules.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Care Schedule
          </h3>
          <div className="space-y-1.5">
            {result.careSchedules.map((cs, i) => renderCareSchedule(cs, i))}
          </div>
        </div>
      )}

      {/* Fertilizer purchase tasks */}
      {result.fertilizers.filter((f) => !f.inStock).length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Purchase Reminders
          </h3>
          <div className="space-y-1">
            {result.fertilizers.filter((f) => !f.inStock).map((f, i) => renderFertilizerTask(f, i))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => {
            const selectedIndexes: number[] = [];
            for (let i = 0; i < selectedTasks.length; i++) {
              if (selectedTasks[i]) selectedIndexes.push(i);
            }
            onConfirm(editingName, editingSciName, selectedIndexes);
          }}
          className="flex-1"
        >
          <Sparkles size={14} />
          Add the Plant
        </Button>
      </div>
    </motion.div>
  );
}

// --- Scissors icon helper for care schedules ---
const ScissorsIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="8.12" y1="8.12" x2="15.88" y2="15.88" />
    <line x1="15.88" y1="8.12" x2="8.12" y2="15.88" />
  </svg>
);

type Screen =
  | "capture"
  | "scanning"
  | "confirm"
  | "manualSearch";

export function IdentifyPlantDialog({
  open,
  onOpenChange,
  onComplete,
}: IdentifyPlantDialogProps) {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [screen, setScreen] = useState<Screen>("capture");
  const [showCamera, setShowCamera] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<IdentificationProgress>({ step: 0, message: "" });
  const [identificationResult, setIdentificationResult] = useState<IdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImageData(null);
    setImageFile(null);
    setScreen("capture");
    setShowCamera(false);
    setUploadError(null);
    setError(null);
    setIdentificationResult(null);
    setScanProgress({ step: 0, message: "" });
    setSaving(false);
  };

  // Reset state when the dialog opens, even if the previous close didn't
  // trigger onOpenChange (e.g. programmatic close via parent setter).
  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open]);

  const handleCapture = (data: string, file?: File) => {
    setImageData(data);
    setImageFile(file ?? null);
    setScreen("capture");
    setShowCamera(false);
    setUploadError(null);
    setError(null);
    setIdentificationResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setError(null);

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/bmp", "image/tiff"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Unsupported format. Allowed: JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image too large. Maximum size is 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setImageFile(file);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleIdentify = async () => {
    if (!imageFile && !imageData) return;

    setError(null);
    setScreen("scanning");
    setScanProgress({ step: 1, message: "Step 1: Identifying species..." });

    try {
      let fileToUse = imageFile;
      if (!fileToUse && imageData) {
        const resp = await fetch(imageData);
        const blob = await resp.blob();
        fileToUse = new File([blob], "capture.webp", { type: "image/webp" });
      }

      if (!fileToUse) throw new Error("No image available");

      const result = await IdentificationManager.identify(fileToUse, (p) => {
        setScanProgress(p);
      }, currentUserId ?? undefined);

      setIdentificationResult(result);

      if (result.species.confidence >= 80) {
        setScreen("confirm");
      } else if (result.topMatches.length > 0) {
        setScreen("confirm");
      } else {
        setScreen("manualSearch");
      }
    } catch (err) {
      console.error("Plant identification failed:", err);
      setError(err instanceof Error ? err.message : "Identification failed. Try again.");
      setScreen("capture");
    }
  };

  const handleConfirm = async (customName?: string, customSciName?: string, selectedIndexes?: number[]) => {
    if (!identificationResult) return;
    setSaving(true);
    setError(null);

    try {
      const name = customName || identificationResult.species.name;
      const sciName = customSciName || identificationResult.species.scientificName;
      const today = new Date().toISOString().split("T")[0];
      const selectedSet = selectedIndexes ? new Set(selectedIndexes) : null;

      // Upload the image to IndexedDB for persistence
      let imageUrl = "";
      if (imageFile || imageData) {
        try {
          const fileToUpload = imageFile
            ? imageFile
            : await (async () => {
                const resp = await fetch(imageData!);
                const blob = await resp.blob();
                return new File([blob], "capture.webp", { type: "image/webp" });
              })();
          imageUrl = await uploadImage(fileToUpload);
        } catch {
          imageUrl = identificationResult.imageDataUrl || "";
        }
      }

      // Build description from identification data
      const careLines: string[] = [];
      if (identificationResult.sunlightNeeds.length > 0) {
        careLines.push(`☀️ Light: ${identificationResult.sunlightNeeds.join(", ")}`);
      }
      for (const cs of identificationResult.careSchedules) {
        const freq = cs.frequencyDays === 1 ? "every day" : `every ${cs.frequencyDays} days`;
        careLines.push(`${cs.label}: ${freq}`);
      }
      if (identificationResult.fertilizers.length > 0) {
        careLines.push(`🧪 Recommended fertilizer: ${identificationResult.fertilizers.map((f) => f.name).join(", ")}`);
      }
      const description = careLines.length > 0
        ? careLines.join("\n")
        : `🌿 ${identificationResult.species.name || identificationResult.species.scientificName || "Plant"}`;

      // Build care schedule tasks — only include user-selected ones
      const careTasks: ActionItem[] = [];
      for (let i = 0; i < identificationResult.careSchedules.length; i++) {
        if (selectedSet && !selectedSet.has(i)) continue;
        const cs = identificationResult.careSchedules[i];
        careTasks.push({
          id: generateId(),
          userId: currentUserId ?? "",
          title: `${cs.label} — ${name}`,
          source: "system",
          type: cs.type as ActionType,
          date: today,
          time: "",
          completed: false,
          notificationSent: false,
          plantIds: [],
          plantNames: [name],
          note: cs.note || `Automated schedule from identification`,
          repeat: "everyXdays",
          repeatConfig: { intervalDays: cs.frequencyDays },
          snoozedUntil: null,
          category: cs.type as ActionType,
          createdAt: new Date().toISOString(),
        });
      }

      // Build fertilizer purchase tasks — only include user-selected ones
      const outOfStockFertilizers = identificationResult.fertilizers.filter((f) => !f.inStock);
      for (let i = 0; i < outOfStockFertilizers.length; i++) {
        const taskIndex = identificationResult.careSchedules.length + i;
        if (selectedSet && !selectedSet.has(taskIndex)) continue;
        const f = outOfStockFertilizers[i];
        careTasks.push({
          id: generateId(),
          userId: currentUserId ?? "",
          title: `Purchase ${f.name} for ${name}`,
          source: "manual",
          type: "maintenance",
          date: today,
          time: "",
          completed: false,
          notificationSent: false,
          plantIds: [],
          plantNames: [name],
          note: `Fertilizer recommended for ${name} (${sciName})`,
          repeat: "none",
          repeatConfig: {},
          snoozedUntil: null,
          category: "maintenance",
          createdAt: new Date().toISOString(),
        });
      }

      onComplete({
        name,
        scientificName: sciName,
        description,
        imageUrl,
        careTasks,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process identification. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMatch = async (name: string, sciName: string) => {
    if (!identificationResult) return;

    // Immediately update the UI so the user sees their selection
    setIdentificationResult({
      ...identificationResult,
      species: { ...identificationResult.species, name, scientificName: sciName, confidence: 100 },
    });
    setScreen("confirm");

    // Fetch fresh care data for the selected species
    try {
      const careData = await IdentificationManager.fetchCareData(sciName, currentUserId ?? undefined);
      setIdentificationResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          careSchedules: careData.careSchedules,
          fertilizers: careData.fertilizers,
          sunlightNeeds: careData.sunlightNeeds,
        };
      });
    } catch {
      // If care data fetch fails, keep the original data — it's better than nothing
      console.warn("Could not fetch care data for selected match:", sciName);
    }
  };

  const handleManualSearchSelect = async (name: string, sciName: string) => {
    setScreen("scanning");
    setScanProgress({ step: 2, message: "Step 2: Retrieving expert care guides..." });

    try {
      const careData = await IdentificationManager.fetchCareData(sciName, currentUserId ?? undefined);
      const result: IdentificationResult = {
        species: { name, scientificName: sciName, confidence: 100 },
        topMatches: [{ name, scientificName: sciName, confidence: 100 }],
        careSchedules: careData.careSchedules,
        fertilizers: careData.fertilizers,
        sunlightNeeds: careData.sunlightNeeds,
        careGuideRaw: null,
        speciesRaw: null,
        imageDataUrl: imageData || undefined,
      };
      setIdentificationResult(result);
      setScreen("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch care data");
      setScreen("capture");
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  const isCapturing = imageData && screen === "capture";

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Identify Plants</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Error banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-2xl bg-red-500/10 px-4 py-3"
            >
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <p className="text-xs text-red-300">{error}</p>
            </motion.div>
          )}

          {uploadError && (
            <p className="text-[11px] text-red-400 text-center">{uploadError}</p>
          )}

          {/* Image Source Selection */}
          {screen === "capture" && !imageData && !showCamera && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCamera(true)}
                className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container/30 p-6 text-center transition-all hover:bg-surface-container/60 hover:border-[var(--theme-primary)]/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/10">
                  <Camera size={24} className="text-[var(--theme-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Take a Photo</p>
                  <p className="mt-0.5 text-[10px] text-on-surface-variant/60">Use your camera</p>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container/30 p-6 text-center transition-all hover:bg-surface-container/60 hover:border-[var(--theme-primary)]/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high">
                  <Upload size={24} className="text-on-surface-variant" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Upload Image</p>
                  <p className="mt-0.5 text-[10px] text-on-surface-variant/60">From your device</p>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,image/tiff"
                className="hidden"
                onChange={handleFileUpload}
                aria-label="Upload plant identification image"
              />
            </div>
          )}

          {/* Camera View */}
          {showCamera && !imageData && (
            <CameraView
              onCapture={(data, file) => {
                handleCapture(data, file);
              }}
            />
          )}

          {/* Captured image preview */}
          {isCapturing && (
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={imageData!}
                alt="Captured plant"
                className="w-full max-h-[35vh] min-h-[180px] object-contain bg-surface-container/40"
              />
              <button
                onClick={() => { setImageData(null); setImageFile(null); }}
                className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm"
              >
                Retake
              </button>
            </div>
          )}

          {/* Identify button */}
          {isCapturing && (
            <Button onClick={handleIdentify} className="w-full" size="lg">
              <Search size={16} />
              Identify Plant
            </Button>
          )}

          {/* Scanning overlay */}
          {screen === "scanning" && (
            <ScanningOverlay progress={scanProgress} onCancel={reset} />
          )}

          {/* Confirm Identity screen — key forces reset when species changes */}
          {screen === "confirm" && identificationResult && (
            <ConfirmIdentityScreen
              key={identificationResult.species.scientificName}
              result={identificationResult}
              onConfirm={handleConfirm}
              onSelectMatch={handleSelectMatch}
              onCancel={reset}
            />
          )}

          {/* Manual search fallback */}
          {screen === "manualSearch" && (
            <ManualNameSearch
              onSelect={handleManualSearchSelect}
              onBack={reset}
            />
          )}

          {/* Saving indicator */}
          {saving && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <RefreshCw size={14} className="animate-spin" />
                Processing...
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
