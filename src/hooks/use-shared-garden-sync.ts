"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { syncAll } from "@/lib/api-client";

const POLL_INTERVAL_MS = 30000; // 30 seconds

/**
 * Polling hook for live updates from shared gardens.
 * Polls GET /api/sync every 30 seconds if the user has any shared gardens.
 * Only updates careEvents + journalEntries to avoid full re-renders.
 * Detects removed gardens (member was removed or garden was deleted).
 */
export function useSharedGardenSync() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const sharedGardens = useAppStore((s) => s.sharedGardens);
  const setSharedGardens = useAppStore((s) => s.setSharedGardens);
  const setCareEvents = useAppStore((s) => s.setCareEvents);
  const setJournalEntries = useAppStore((s) => s.setJournalEntries);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sharedGardensRef = useRef(sharedGardens);

  // Keep the ref up to date so the poll callback always reads the latest value
  sharedGardensRef.current = sharedGardens;

  useEffect(() => {
    // If no shared gardens, clear any existing interval
    if (sharedGardens.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // If already polling, don't set up another
    if (intervalRef.current) return;

    const poll = async () => {
      try {
        const payload = await syncAll();

        // Check for gardens that were removed (member was removed or garden was deleted)
        const newGardenIds = new Set(
          (payload.sharedGardens || []).map((g: any) => g.id)
        );
        const currentGardens = sharedGardensRef.current;
        const removedGardens = currentGardens.filter(
          (g) => !newGardenIds.has(g.id)
        );

        if (removedGardens.length > 0) {
          // Garden was deleted or member was removed
          setSharedGardens(payload.sharedGardens as any[]);
        }

        // Update care events
        if (payload.careEvents) {
          setCareEvents(payload.careEvents as any[]);
        }

        // Update journal entries
        if (payload.journals) {
          setJournalEntries(payload.journals as any[]);
        }
      } catch {
        // Silently fail — next poll will retry
      }
    };

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sharedGardens.length > 0]); // Only re-run when going from 0→>0 or >0→0
}
