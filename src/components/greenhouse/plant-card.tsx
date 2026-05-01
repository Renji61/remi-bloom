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
import { Card, CardContent } from "@/components/ui";
import { SafeImage } from "@/components/ui/safe-image";
import { useAppStore } from "@/stores/app-store";
import type { Plant, CareEvent, PlantLocation } from "@/lib/db";
import { formatDateShort, getRelativeTime } from "@/lib/utils";

interface PlantCardProps {
  plant: Plant;
  lastCareEvent?: CareEvent;
  location?: PlantLocation;
  thumbnailUrl?: string | null;
  onQuickWater: () => void;
  onQuickFertilize: () => void;
  onOpenDetail: () => void;
  onEdit: () => void;
  index?: number;
}

export function PlantCard({
  plant,
  lastCareEvent,
  location,
  thumbnailUrl,
  onQuickWater,
  onQuickFertilize,
  onOpenDetail,
  onEdit,
  index = 0,
}: PlantCardProps) {
  const tags = useAppStore((s) => s.tags);
  const dateForAge = plant.plantedDate || plant.createdAt;

  const plantTags = tags.filter((t) => plant.tags?.includes(t.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.01, duration: 0.3 }}
    >
      <Card className="group cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-[var(--theme-primary)]/30">
        <CardContent className="p-4">
          {/* Top Row */}
          <div className="flex items-start gap-3">
            {/* Emoji / Photo */}
            <div
              onClick={onOpenDetail}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-2xl overflow-hidden"
            >
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
            <div onClick={onOpenDetail} className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-on-surface truncate">
                {plant.name}
              </h3>
              <p className="text-xs text-on-surface-variant/70 italic truncate">
                {plant.scientificName}
              </p>

              {/* Location Badge */}
              {location && (
                <div className="mt-1 flex items-center gap-1">
                  <MapPin size={10} className="text-[var(--theme-primary)]/60" />
                  <span className="text-[10px] text-[var(--theme-primary)]/70 truncate">
                    {location.name}
                  </span>
                </div>
              )}
            </div>

            {/* Age & Edit */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className="text-[18px] font-bold tabular-nums text-on-surface-variant/40">
                {getRelativeTime(dateForAge)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="rounded-lg p-1 text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface-variant transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Pencil size={10} />
              </button>
            </div>
          </div>

          {/* Tags */}
          {plantTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {plantTags.map((tag) => {
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
            </div>
          )}

          {/* Last Care */}
          {lastCareEvent && (
            <div
              onClick={onOpenDetail}
              className="mt-2 flex items-center gap-1.5 rounded-xl bg-surface-container/50 px-2.5 py-1.5"
            >
              <Clock size={10} className="text-on-surface-variant/50" />
              <span className="text-[10px] text-on-surface-variant/60">
                {careEventLabel(lastCareEvent.type)} —{" "}
                {formatDateShort(new Date(lastCareEvent.date))}
              </span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickWater();
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-500/10 px-2 py-1.5 text-[10px] font-semibold text-blue-500 transition-colors hover:bg-blue-500/20"
            >
              <Droplets size={12} />
              Water
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickFertilize();
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20"
            >
              <FlaskConical size={12} />
              Fertilize
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
              className="flex items-center justify-center rounded-xl bg-surface-container-high px-2 py-1.5 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            >
              <Sparkles size={12} />
            </button>
          </div>
        </CardContent>
      </Card>
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
