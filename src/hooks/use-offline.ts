"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { replaySyncQueue } from "@/lib/db";
import { loadUserData, markApiAvailable } from "@/lib/load-user-data";

export function useOffline() {
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const syncNow = async () => {
      const userId = useAppStore.getState().currentUserId;
      if (!userId || !navigator.onLine) return;
      setConnectionStatus({ syncing: true });
      try {
        await replaySyncQueue(userId);
        await loadUserData(userId);
      } finally {
        setConnectionStatus({ syncing: false });
      }
    };

    const update = () => {
      setConnectionStatus({ offline: !navigator.onLine });
      if (navigator.onLine) {
        void syncNow();
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    void syncNow();

    intervalRef.current = setInterval(async () => {
      if (!navigator.onLine) {
        setConnectionStatus({ syncing: false, latency: null, offline: true });
        return;
      }
      const start = Date.now();
      try {
        setConnectionStatus({ syncing: true });
        const resp = await fetch("/api/ping", {
          method: "HEAD",
          cache: "no-store",
        });
        const latency = Date.now() - start;
        markApiAvailable(resp.ok);
        setConnectionStatus({
          syncing: false,
          latency: resp.ok ? latency : null,
          offline: !resp.ok,
        });
        if (resp.ok) {
          void syncNow();
        }
      } catch {
        markApiAvailable(false);
        setConnectionStatus({ syncing: false, latency: null, offline: true });
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setConnectionStatus, currentUserId]);
}
