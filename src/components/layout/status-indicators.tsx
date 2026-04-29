"use client";

import { motion } from "framer-motion";
import { Wifi, WifiOff, Clock } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export function StatusIndicators() {
  const status = useAppStore((s) => s.connectionStatus);

  return (
    <div className="flex items-center gap-3">
      {/* Syncing Indicator */}
      <motion.div
        className="relative flex h-2.5 w-2.5 items-center justify-center"
        animate={
          status.syncing
            ? {
                scale: [1, 1.3, 1],
                opacity: [0.6, 1, 0.6],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            status.syncing
              ? "bg-[var(--theme-primary)] shadow-[0_0_6px_var(--theme-primary)]"
              : "bg-[var(--theme-primary)]/40"
          )}
        />
        {status.syncing && (
          <motion.div
            className="absolute inset-0 rounded-full bg-[var(--theme-primary)]/30"
            animate={{ scale: [1, 1.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Latency Indicator */}
      <div className="flex items-center gap-1">
        {status.latency !== null && status.latency > 200 ? (
          <Clock size={12} className="text-amber-400" />
        ) : (
          <Clock size={12} className="text-on-surface-variant/40" />
        )}
        <span
          className={cn(
            "text-[10px] font-mono tabular-nums",
            status.latency !== null && status.latency > 200
              ? "text-amber-400"
              : "text-on-surface-variant/40"
          )}
        >
          {status.latency !== null ? `${status.latency}ms` : "---"}
        </span>
      </div>

      {/* Offline Indicator */}
      <div
        className={cn(
          "transition-all duration-300",
          status.offline ? "opacity-100" : "opacity-30"
        )}
      >
        {status.offline ? (
          <WifiOff size={14} className="text-slate-400" />
        ) : (
          <Wifi size={14} className="text-[var(--theme-primary)]/60" />
        )}
      </div>
    </div>
  );
}
