"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      // serwist v9 handles SW registration via next.config.ts
      // The SW is compiled to /sw.js and registered automatically
    }
  }, []);

  return null;
}
