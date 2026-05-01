"use client";

import { motion } from "framer-motion";
import {
  Droplets,
  FlaskConical,
  MapPin,
  Clock,
  Sparkles,
  Pencil,
} from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { useAppStore } from "@/stores/app-store";
import type { Plant, CareEvent, PlantLocation } from "@/lib/db";
import { formatDateShort, getRelativeTime } from "@/lib/utils";

interface PlantListViewProps {
  plant: Plant;
  lastCareEvent?: CareEvent;
  location?: PlantLocation;
  thumbnailUrl?: string | null;
  onQuickWater?: () => void;
  onQuickFertilize?: () => void;
  onOpenDetail: () => void;
  onEdit?: () => void;
  canDelete?: boolean;
  canLogCare?: boolean;
  index?: number;
}

export function PlantListView({
  plant,
  lastCareEvent,
  location,
  thumbnailUrl,
  onQuickWater,
  onQuickFertilize,
  onOpenDetail,
  onEdit,
  canDelete = true,
  canLogCare = true,
  index = 0,
}: PlantListViewProps) {
  const tags = useAppStore((s) => s.tags);
  const dateForAge = plant.plantedDate || plant.createdAt;

  const plantTags = tags.filter((t) => plant.tags?.includes(t.id));

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (index ?? 0) * 0.01, duration: 0.3 }}
      layout
    >
      <div
        onClick={onOpenDetail}
        className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container/30 px-4 py-3 transition-all duration-200 hover:bg-surface-container/60 hover:ring-1 hover:ring-[var(--theme-primary)]/30"
      >
        {/* Emoji / Photo */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-xl overflow-hidden">
          {thumbnailUrl ? (
            <SafeImage
              src={thumbnailUrl}
              alt={plant.name}
              className="h-full w-full object-cover"
            />
          ) : plant.imageUrl && !plant.imageUrl.startsWith("upload:") ? (
            <SafeImage
              src={plant.imageUrl}
              alt={plant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            plant.emoji
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-on-surface truncate">
              {plant.name}
            </h3>
            {/* Age */}
            <span className="shrink-0 rounded-md bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-on-surface-variant/50">
              {getRelativeTime(dateForAge)}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant/70 italic truncate">
            {plant.scientificName}
          </p>

          {/* Location & Tags row */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {location && (
              <div className="flex items-center gap-1">
                <MapPin size={10} className="text-[var(--theme-primary)]/60" />
                <span className="text-[10px] text-[var(--theme-primary)]/70 truncate">
                  {location.name}
                </span>
              </div>
            )}
            {plantTags.length > 0 &&
              plantTags.slice(0, 2).map((tag) => {
                const hex = tag.color.replace("#", "");
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                const textColor = brightness > 128 ? "rgba(0,0,0,0.7)" : "#fff";
                return (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                    style={{
                      backgroundColor: tag.color + "30",
                      color: textColor,
                    }}
                  >
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                );
              })}
            {plantTags.length > 2 && (
              <span className="text-[8px] text-on-surface-variant/40">
                +{plantTags.length - 2}
              </span>
            )}
          </div>
        </div>

        {/* Last Care */}
        {lastCareEvent && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-surface-container/50 px-2.5 py-1.5">
            <Clock size={10} className="text-on-surface-variant/50" />
            <span className="text-[10px] text-on-surface-variant/60 whitespace-nowrap">
              {careEventLabel(lastCareEvent.type)} —{" "}
              {formatDateShort(new Date(lastCareEvent.date))}
            </span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          {canLogCare && onQuickWater && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickWater();
              }}
              className="flex items-center justify-center rounded-lg bg-blue-500/10 p-1.5 text-blue-500 transition-colors hover:bg-blue-500/20"
              aria-label="Quick Water"
            >
              <Droplets size={14} aria-hidden="true" />
            </button>
          )}
          {canLogCare && onQuickFertilize && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickFertilize();
              }}
              className="flex items-center justify-center rounded-lg bg-emerald-500/10 p-1.5 text-emerald-500 transition-colors hover:bg-emerald-500/20"
              aria-label="Quick Fertilize"
            >
              <FlaskConical size={14} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
            className="flex items-center justify-center rounded-lg bg-surface-container-high p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            aria-label="Details"
          >
            <Sparkles size={14} aria-hidden="true" />
          </button>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex items-center justify-center rounded-lg p-1.5 text-on-surface-variant/40 transition-colors hover:bg-surface-container-high hover:text-on-surface-variant"
              aria-label="Edit"
            >
              <Pencil size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function careEventLabel(type: CareEvent["type"]): string {
  switch (type) {
    case "water":
      return "Watered";
    case "fertilize":
      return "Fertilized";
    case "repot":
      return "Repotted";
    case "prune":
      return "Pruned";
    default:
      return "Care logged";
  }
}
