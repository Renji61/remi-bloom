"use client";

import { useState, useRef } from "react";
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
  User,
  RefreshCw,
  Sprout,
} from "lucide-react";
import { Button, Card, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";
import { CameraView } from "./camera-view";
import { IdentificationManager } from "@/lib/identification-manager";
import { addActionItem, addPlant, uploadImage } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import type {
  IdentificationResult,
  CareScheduleSuggestion,
  FertilizerSuggestion,
  IdentificationProgress,
} from "@/lib/identification-manager";
import type { ActionItem, ActionType } from "@/lib/db";

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

// --- Summary Card after save ---

function SummaryCard({
  result,
  createdTasks,
  onDone,
}: {
  result: IdentificationResult;
  createdTasks: string[];
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4"
    >
      <Card>
        <CardContent className="p-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <Sprout size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-on-surface">Plant Identified!</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Identified as:{" "}
            <span className="font-semibold italic text-[var(--theme-primary)]">
              {result.species.name}
            </span>
          </p>
          {result.species.scientificName && (
            <p className="text-xs text-on-surface-variant/60 italic">
              {result.species.scientificName}
            </p>
          )}
          {result.careSchedules.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {createdTasks.map((task, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/80"
                >
                  <Check size={12} />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Button onClick={onDone} className="w-full">
        Done
      </Button>
    </motion.div>
  );
}

// --- Confirm Identity screen ---

function ConfirmIdentityScreen({
  result,
  onConfirm,
  onSelectMatch,
  onCancel,
  inventory,
}: {
  result: IdentificationResult;
  onConfirm: (customName?: string, customSciName?: string) => void;
  onSelectMatch: (name: string, sciName: string) => void;
  onCancel: () => void;
  inventory: { name: string; category: string }[];
}) {
  const [editingName, setEditingName] = useState(result.species.name);
  const [editingSciName, setEditingSciName] = useState(result.species.scientificName);

  const renderCareSchedule = (cs: CareScheduleSuggestion) => (
    <div key={cs.type} className="flex items-center gap-2 rounded-xl bg-surface-container/60 px-3 py-2">
      {cs.type === "water" && <Droplets size={14} className="text-blue-400" />}
      {cs.type === "fertilize" && <Sprout size={14} className="text-emerald-400" />}
      {cs.type === "prune" && <ScissorsIcon size={14} className="text-purple-400" />}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-on-surface">{cs.label}</p>
        <p className="text-[9px] text-on-surface-variant/60">Every {cs.frequencyDays} days</p>
      </div>
      <Check size={14} className="shrink-0 text-emerald-400" />
    </div>
  );

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

      {/* Other matches (if confidence < 80%) */}
      {result.topMatches.length > 1 && result.species.confidence < 80 && (
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

      {/* Care schedule suggestions */}
      {result.careSchedules.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Care Schedule
          </h3>
          <div className="space-y-1.5">
            {result.careSchedules.map(renderCareSchedule)}
          </div>
        </div>
      )}

      {/* Fertilizer suggestions */}
      {result.fertilizers.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Recommended Fertilizers
          </h3>
          <div className="space-y-1">
            {result.fertilizers.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl bg-surface-container/40 px-3 py-2"
              >
                <Package size={12} className="text-on-surface-variant/50" />
                <span className="flex-1 text-[11px] text-on-surface-variant">{f.name}</span>
                {f.inStock ? (
                  <span className="text-[9px] text-emerald-400">In stock</span>
                ) : (
                  <span className="text-[9px] text-amber-400">Not in inventory</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(editingName, editingSciName)}
          className="flex-1"
        >
          <Check size={14} />
          Confirm & Save
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

// ===============================
// MAIN COMPONENT
// ===============================

type Screen =
  | "capture"
  | "scanning"
  | "confirm"
  | "summary"
  | "manualSearch";

export function PlantIdentifier() {
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
  const [createdTasks, setCreatedTasks] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        // Convert data URL back to File
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
        // Low confidence — show confirm screen with alternatives
        setScreen("confirm");
      } else {
        // No results at all
        setScreen("manualSearch");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identification failed. Try again.");
      setScreen("capture");
    }
  };

  const handleConfirm = async (customName?: string, customSciName?: string) => {
    if (!identificationResult) return;
    setSaving(true);
    setError(null);

    try {
      const tasks: string[] = [];
      const plantId = generateId();
      const name = customName || identificationResult.species.name;
      const sciName = customSciName || identificationResult.species.scientificName;
      const today = new Date().toISOString().split("T")[0];

      // Upload the image to IndexedDB for persistence
      let imageUrl = identificationResult.imageDataUrl || "";
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
          // Fall back to data URL if upload to IndexedDB fails
          imageUrl = identificationResult.imageDataUrl || "";
        }
      }

      // 1. Save the plant
      const plant = {
        id: plantId,
        userId: currentUserId ?? "",
        name,
        scientificName: sciName,
        description: `Identified via PlantIntelligenceService on ${new Date().toLocaleDateString()}. Confidence: ${identificationResult.species.confidence}%.`,
        emoji: "🌿",
        imageUrl,
        createdAt: new Date().toISOString(),
        plantedDate: null,
        locationId: null,
        tags: [],
      };
      await addPlant(plant);

      // 2. Create ActionItems for each care schedule
      for (const cs of identificationResult.careSchedules) {
        const actionItem: ActionItem = {
          id: generateId(),
          userId: currentUserId ?? "",
          title: `${cs.label} — ${name}`,
          source: "system",
          type: cs.type as ActionType,
          date: today,
          time: "",
          completed: false,
          notificationSent: false,
          plantIds: [plantId],
          plantNames: [name],
          note: cs.note || `Automated ${(cs.label || cs.type).toLowerCase()} schedule from identification`,
          repeat: "everyXdays",
          repeatConfig: { intervalDays: cs.frequencyDays },
          snoozedUntil: null,
          category: cs.type as ActionType,
          createdAt: new Date().toISOString(),
        };
        await addActionItem(actionItem);

        const taskLabel =
          cs.type === "water"
            ? "watering"
            : cs.type === "fertilize"
              ? "fertilizing"
              : cs.type === "prune"
                ? "pruning"
                : (cs.label || cs.type).toLowerCase();
        tasks.push(`Added ${taskLabel} reminder every ${cs.frequencyDays} days`);
      }

      // 3. Create "purchase fertilizer" tasks for missing fertilizers
      for (const f of identificationResult.fertilizers) {
        if (!f.inStock) {
          const actionItem: ActionItem = {
            id: generateId(),
            userId: currentUserId ?? "",
            title: `Purchase ${f.name} for ${name}`,
            source: "manual",
            type: "maintenance",
            date: today,
          time: "",
          completed: false,
          notificationSent: false,
          plantIds: [plantId],
            plantNames: [name],
            note: `Fertilizer recommended for ${name} (${sciName})`,
            repeat: "none",
            repeatConfig: {},
            snoozedUntil: null,
            category: "maintenance",
            createdAt: new Date().toISOString(),
          };
          await addActionItem(actionItem);
          tasks.push(`Added task: Purchase ${f.name}`);
        }
      }

      setCreatedTasks(tasks);
      setScreen("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMatch = (name: string, sciName: string) => {
    if (!identificationResult) return;
    // Update the top match and re-show confirm screen
    setIdentificationResult({
      ...identificationResult,
      species: { ...identificationResult.species, name, scientificName: sciName, confidence: 100 },
    });
    setScreen("confirm");
  };

  const handleManualSearchSelect = async (name: string, sciName: string) => {
    // Fetch care data for the manually selected plant
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

  const handleReset = () => {
    setImageData(null);
    setImageFile(null);
    setScreen("capture");
    setShowCamera(false);
    setUploadError(null);
    setError(null);
    setIdentificationResult(null);
    setCreatedTasks([]);
    setScanProgress({ step: 0, message: "" });
  };

  const isCapturing = imageData && screen === "capture";

  return (
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

      {/* Captured image preview — responsive height so identify button is always visible */}
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
        <ScanningOverlay progress={scanProgress} onCancel={handleReset} />
      )}

      {/* Confirm Identity screen */}
      {screen === "confirm" && identificationResult && (
        <ConfirmIdentityScreen
          result={identificationResult}
          onConfirm={handleConfirm}
          onSelectMatch={handleSelectMatch}
          onCancel={handleReset}
          inventory={[]}
        />
      )}

      {/* Manual search fallback */}
      {screen === "manualSearch" && (
        <ManualNameSearch
          onSelect={handleManualSearchSelect}
          onBack={handleReset}
        />
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <RefreshCw size={14} className="animate-spin" />
            Saving plant and creating tasks...
          </div>
        </div>
      )}

      {/* Summary */}
      {screen === "summary" && identificationResult && (
        <SummaryCard
          result={identificationResult}
          createdTasks={createdTasks}
          onDone={handleReset}
        />
      )}
    </div>
  );
}
