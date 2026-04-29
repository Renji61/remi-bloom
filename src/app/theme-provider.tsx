"use client";

import { useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useAppStore } from "@/stores/app-store";
import type { ThemeMode, ThemeColor } from "@/lib/theme-config";

const THEME_MODE_KEY = "remi-bloom-theme-mode";
const THEME_COLOR_KEY = "remi-bloom-theme-color";

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
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const setThemeColor = useAppStore((s) => s.setThemeColor);

  // Load persisted settings on mount (before first render paints)
  useEffect(() => {
    const persisted = loadPersistedTheme();
    if (persisted.mode) setThemeMode(persisted.mode);
    if (persisted.color) setThemeColor(persisted.color);
  }, [setThemeMode, setThemeColor]);

  useTheme();

  // Persist to localStorage whenever values change
  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {}
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_COLOR_KEY, themeColor);
    } catch {}
  }, [themeColor]);

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
