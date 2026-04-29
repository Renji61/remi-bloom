"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui";
import { SafeImage } from "@/components/ui/safe-image";
import { BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/db";
import type { JournalEntry as JournalEntryType } from "@/lib/db";

interface JournalEntryCardProps {
  entry: JournalEntryType;
  index?: number;
  showType?: boolean;
}

export function JournalEntryCard({ entry, index = 0, showType }: JournalEntryCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card>
        <div className="flex flex-col gap-1.5 p-5 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {showType && (
                <BookOpen size={12} className="text-[var(--theme-primary)] shrink-0" />
              )}
              <span className="text-xs font-semibold text-[var(--theme-primary)] truncate">
                {entry.plantName}
              </span>
            </div>
            <span className="shrink-0 text-[10px] text-on-surface-variant/50 ml-2">
              {formatDate(new Date(entry.date))}
            </span>
          </div>
        </div>
        <CardContent>
          <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">
            {entry.note}
          </p>
          {photoUrl && (
            <SafeImage
              src={photoUrl}
              alt="Journal photo"
              className="mt-3 max-h-64 w-full rounded-xl object-cover"
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
