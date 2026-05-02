"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";

interface KeysStatus {
  plantidConfigured: boolean;
  perenualConfigured: boolean;
  weatherConfigured: boolean;
  overridable: boolean;
  loaded: boolean;
}

const defaultStatus: KeysStatus = {
  plantidConfigured: false,
  perenualConfigured: false,
  weatherConfigured: false,
  overridable: true,
  loaded: false,
};

/**
 * Hook that fetches /api/settings/keys-status to check whether
 * each API key is available (from env var or user settings).
 * Caches result in memory for the session.
 */
let cachedStatus: KeysStatus | null = null;
let fetchPromise: Promise<void> | null = null;

export function useApiKeysStatus(): KeysStatus {
  const [status, setStatus] = useState<KeysStatus>(cachedStatus ?? defaultStatus);
  const currentUserId = useAppStore((s) => s.currentUserId);

  useEffect(() => {
    if (!currentUserId) return;

    // Already cached from a previous call
    if (cachedStatus) {
      setStatus(cachedStatus);
      return;
    }

    // Avoid duplicate in-flight requests
    if (!fetchPromise) {
      fetchPromise = (async () => {
        try {
          const res = await fetch("/api/settings/keys-status", { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            cachedStatus = {
              plantidConfigured: !!data.plantidConfigured,
              perenualConfigured: !!data.perenualConfigured,
              weatherConfigured: !!data.weatherConfigured,
              overridable: data.overridable !== false,
              loaded: true,
            };
            setStatus(cachedStatus);
          } else {
            setStatus((prev) => ({ ...prev, loaded: true }));
          }
        } catch {
          setStatus((prev) => ({ ...prev, loaded: true }));
        }
      })();
    }

    fetchPromise.then(() => {
      if (cachedStatus) setStatus(cachedStatus);
    });
  }, [currentUserId]);

  return status;
}
