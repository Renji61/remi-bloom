"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/stores/app-store";
import type { ThemeMode, ThemeColor } from "@/lib/theme-config";
import { getUserSetting, setUserSetting } from "@/lib/db";

const THEME_MODE_KEY = "remi-bloom-theme-mode";
const THEME_COLOR_KEY = "remi-bloom-theme-color";
const VALID_THEME_MODES: ThemeMode[] = ["dark", "light", "system"];
const VALID_THEME_COLORS: ThemeColor[] = ["emerald", "terracotta", "sky", "lavender", "rose"];

function loadPersistedTheme(): { mode?: ThemeMode; color?: ThemeColor } {
  if (typeof window === "undefined") return {};
  try {
    const mode = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
    const color = localStorage.getItem(THEME_COLOR_KEY) as ThemeColor | null;
    return {
      mode: mode && ["dark", "light", "system"].includes(mode) ? mode : undefined,
      color: color && ["emerald", "terracotta", "sky", "lavender", "rose"].includes(color) ? color : undefined,
    };
  } catch {
    return {};
  }
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeMode = useAppStore((s) => s.themeMode);
  const themeColor = useAppStore((s) => s.themeColor);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const setThemeColor = useAppStore((s) => s.setThemeColor);
  const [userThemeLoadedFor, setUserThemeLoadedFor] = useState<string | null>(null);

  // Load persisted settings on mount (before first render paints)
  useEffect(() => {
    const persisted = loadPersistedTheme();
    if (persisted.mode) setThemeMode(persisted.mode);
    if (persisted.color) setThemeColor(persisted.color);
  }, [setThemeMode, setThemeColor]);

  useEffect(() => {
    let cancelled = false;

    async function loadUserTheme() {
      if (!currentUserId) {
        setUserThemeLoadedFor(null);
        return;
      }

      const [mode, color] = await Promise.all([
        getUserSetting(currentUserId, "themeMode"),
        getUserSetting(currentUserId, "themeColor"),
      ]);

      if (cancelled) return;

      if (mode && VALID_THEME_MODES.includes(mode as ThemeMode)) {
        setThemeMode(mode as ThemeMode);
      }
      if (color && VALID_THEME_COLORS.includes(color as ThemeColor)) {
        setThemeColor(color as ThemeColor);
      }
      setUserThemeLoadedFor(currentUserId);
    }

    void loadUserTheme();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, setThemeMode, setThemeColor]);

  useTheme();

  // Persist to localStorage whenever values change
  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {}
    if (currentUserId && userThemeLoadedFor === currentUserId) {
      void setUserSetting(currentUserId, "themeMode", themeMode);
    }
  }, [currentUserId, themeMode, userThemeLoadedFor]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_COLOR_KEY, themeColor);
    } catch {}
    if (currentUserId && userThemeLoadedFor === currentUserId) {
      void setUserSetting(currentUserId, "themeColor", themeColor);
    }
  }, [currentUserId, themeColor, userThemeLoadedFor]);

  return (
    <div
      data-theme-color={themeColor}
      data-theme-mode={themeMode}
      className="min-h-dvh"
    >
      {children}
    </div>
  );
}
