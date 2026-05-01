"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui";
import { SafeImage } from "@/components/ui/safe-image";
import { BookOpen, TrendingUp, Ruler, Leaf, Apple } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/db";
import type { JournalEntry, ProgressEntry } from "@/lib/db";

export type TimelineEntryType = "journal" | "growth";

interface TimelineEntryCardProps {
  entry: JournalEntry | ProgressEntry;
  type: TimelineEntryType;
  index?: number;
  plant?: { emoji: string; name: string };
}

export function TimelineEntryCard({
  entry,
  type,
  index = 0,
  plant,
}: TimelineEntryCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const growthEntry = type === "growth" ? (entry as ProgressEntry) : null;

  useEffect(() => {
    if (entry.photoUrl && entry.photoUrl.startsWith("upload:")) {
      const imageId = entry.photoUrl.slice(7);
      getImageUrl(imageId).then((url) => {
        if (url) setPhotoUrl(url);
      });
    } else if (entry.photoUrl) {
      setPhotoUrl(entry.photoUrl);
    }
  }, [entry.photoUrl]);

  const isJournal = type === "journal";
  const headerIcon = isJournal ? (
    <BookOpen size={12} className="shrink-0 text-[var(--theme-primary)]" />
  ) : (
    <TrendingUp size={12} className="shrink-0 text-emerald-500" />
  );
  const headerColor = isJournal ? "text-[var(--theme-primary)]" : "text-emerald-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card>
        <div className="flex flex-col gap-1.5 p-5 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {headerIcon}
              <span className={`truncate text-xs font-semibold ${headerColor}`}>
                {plant
                  ? `${plant.emoji} ${entry.plantName}`
                  : entry.plantName}
              </span>
            </div>
            <span className="ml-2 shrink-0 text-[10px] text-on-surface-variant/50">
              {formatDate(new Date(entry.date))}
            </span>
          </div>
        </div>

        <CardContent>
          {/* Growth metrics badges */}
          {growthEntry && (
            <div className="mb-2 flex flex-wrap gap-3">
              {growthEntry.height > 0 && (
                <div className="flex items-center gap-1 text-xs text-on-surface-variant/80">
                  <Ruler size={12} className="text-emerald-500/70" />
                  <span>
                    {growthEntry.height}
                    {growthEntry.heightUnit === "cm" ? " cm" : " in"}
                  </span>
                </div>
              )}
              {growthEntry.leafCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-on-surface-variant/80">
                  <Leaf size={12} className="text-emerald-500/70" />
                  <span>{growthEntry.leafCount} leaves</span>
                </div>
              )}
              {growthEntry.harvestYield && (
                <div className="flex items-center gap-1 text-xs text-on-surface-variant/80">
                  <Apple size={12} className="text-amber-500/70" />
                  <span>{growthEntry.harvestYield}</span>
                </div>
              )}
            </div>
          )}

          {/* Note content (handles both journal `note` and growth `notes` fields) */}
          {isJournal ? (
            (entry as JournalEntry).note && (
              <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">
                {(entry as JournalEntry).note}
                {(entry as JournalEntry).performedBy && (
                  <span className="text-[10px] text-on-surface-variant/40 ml-1">
                    — by {(entry as JournalEntry).performedBy}
                  </span>
                )}
              </p>
            )
          ) : (
            growthEntry?.notes && (
              <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">
                {growthEntry.notes}
              </p>
            )
          )}

          {photoUrl && (
            <SafeImage
              src={photoUrl}
              alt={isJournal ? "Journal photo" : "Growth log photo"}
              className="mt-3 max-h-32 w-full max-w-[160px] rounded-xl object-cover"
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
