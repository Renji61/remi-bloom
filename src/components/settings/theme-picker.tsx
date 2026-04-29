"use client";

import { useAppStore } from "@/stores/app-store";
import { themeColorSchemes, themeColorLabels } from "@/lib/theme-config";
import { cn } from "@/lib/utils";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

const colorKeys = Object.keys(themeColorSchemes);

export function ThemePicker() {
  const themeColor = useAppStore((s) => s.themeColor);
  const setThemeColor = useAppStore((s) => s.setThemeColor);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  const modeOptions = [
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-on-surface-variant/70">
          Display Mode
        </p>
        <div className="flex gap-2">
          {modeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setThemeMode(value)}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 rounded-2xl border px-4 py-3 transition-all duration-200",
                themeMode === value
                  ? "border-[var(--theme-primary)]/50 bg-[var(--theme-primary)]/10"
                  : "border-outline-variant/40 bg-surface-container/30 hover:bg-surface-container/60"
              )}
            >
              <Icon
                size={20}
                className={
                  themeMode === value
                    ? "text-[var(--theme-primary)]"
                    : "text-on-surface-variant"
                }
              />
              <span
                className={cn(
                  "text-xs font-semibold",
                  themeMode === value
                    ? "text-[var(--theme-primary)]"
                    : "text-on-surface-variant"
                )}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-on-surface-variant/70">
          Accent Color
        </p>
        <div className="grid grid-cols-5 gap-3">
          {colorKeys.map((key) => {
            const scheme = themeColorSchemes[key];
            const isActive = themeColor === key;
            return (
              <button
                key={key}
                onClick={() => setThemeColor(key as keyof typeof themeColorSchemes)}
                className="group relative flex flex-col items-center gap-2"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
                    isActive && "ring-2 ring-offset-2 ring-offset-surface"
                  )}
                  style={{
                    backgroundColor: scheme.primary,
                    "--ring-color": scheme.primary,
                  } as React.CSSProperties}
                >
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <Check size={16} className="text-[var(--theme-onPrimary)]" />
                    </motion.div>
                  )}
                </div>
                <span className="text-[9px] font-medium text-on-surface-variant/60 text-center leading-tight">
                  {themeColorLabels[key as keyof typeof themeColorLabels]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
