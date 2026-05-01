"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { themeColorSchemes, type ThemeColor, type ThemeMode } from "@/lib/theme-config";

export function useTheme() {
  const themeMode = useAppStore((s) => s.themeMode);
  const themeColor = useAppStore((s) => s.themeColor);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const setThemeColor = useAppStore((s) => s.setThemeColor);

  // Apply theme to document whenever mode or color changes
  useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(themeMode);

    root.setAttribute("data-theme", resolved);
    root.classList.toggle("dark", resolved === "dark");
    root.classList.toggle("light", resolved === "light");

    applyThemeColor(themeColor, resolved);
    updateMetaThemeColor(themeColor, resolved);
  }, [themeMode, themeColor]);

  // Listen for OS-level theme changes when in "system" mode
  useEffect(() => {
    if (themeMode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = document.documentElement;
      const resolved = mq.matches ? "dark" : "light";
      root.setAttribute("data-theme", resolved);
      root.classList.toggle("dark", resolved === "dark");
      root.classList.toggle("light", resolved === "light");
      applyThemeColor(themeColor, resolved);
      updateMetaThemeColor(themeColor, resolved);
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [themeMode, themeColor]);

  return { themeMode, themeColor, setThemeMode, setThemeColor };
}

function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyThemeColor(color: ThemeColor, mode: "dark" | "light") {
  const scheme = themeColorSchemes[color];
  if (!scheme) return;

  const root = document.documentElement;
  const vars = mode === "dark" ? scheme : invertScheme(scheme);
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(`--theme-${key}`, value);
  });
}

function invertScheme(
  scheme: { [key: string]: string }
): { [key: string]: string } {
  const inverted: Record<string, string> = {};
  const pairs: [string, string][] = [
    ["primary", "onPrimary"],
    ["onPrimary", "primary"],
    ["primaryContainer", "onPrimaryContainer"],
    ["onPrimaryContainer", "primaryContainer"],
    ["surfaceTint", "surfaceTint"],
    ["primaryFixed", "onPrimaryFixed"],
    ["onPrimaryFixed", "primaryFixed"],
    ["primaryFixedDim", "onPrimaryFixedVariant"],
    ["onPrimaryFixedVariant", "primaryFixedDim"],
    ["inversePrimary", "inversePrimary"],
  ];
  pairs.forEach(([a, b]) => {
    if (scheme[a]) inverted[b] = scheme[a];
  });
  return inverted;
}

function updateMetaThemeColor(color: ThemeColor, mode: "dark" | "light") {
  const scheme = themeColorSchemes[color];
  if (!scheme) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      mode === "dark" ? scheme.primaryContainer : scheme.onPrimaryContainer
    );
  }
}
