"use client";

import { useState, useEffect } from "react";
import { DollarSign } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { currencyOptions, currencyInfo } from "@/hooks/use-currency";
import { getUserSetting, setUserSetting } from "@/lib/db";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENCY_CODE_KEY = "currencyCode";
const CURRENCY_SYMBOL_KEY = "currencySymbol";

export function CurrencySettings() {
  const currencyCode = useAppStore((s) => s.currencyCode);
  const currencySymbol = useAppStore((s) => s.currencySymbol);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setCurrencyCode = useAppStore((s) => s.setCurrencyCode);
  const setCurrencySymbol = useAppStore((s) => s.setCurrencySymbol);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted currency from IndexedDB
  useEffect(() => {
    async function load() {
      if (!currentUserId) {
        setLoaded(true);
        return;
      }

      const [code, symbol] = await Promise.all([
        getUserSetting(currentUserId, CURRENCY_CODE_KEY),
        getUserSetting(currentUserId, CURRENCY_SYMBOL_KEY),
      ]);
      if (code) setCurrencyCode(code);
      if (symbol) setCurrencySymbol(symbol);
      setLoaded(true);
    }
    load();
  }, [currentUserId, setCurrencyCode, setCurrencySymbol]);

  const handleSelect = async (code: string) => {
    if (!currentUserId) return;
    setSaving(true);
    const info = currencyInfo[code];
    if (info) {
      setCurrencyCode(info.code);
      setCurrencySymbol(info.symbol);
      await setUserSetting(currentUserId, CURRENCY_CODE_KEY, info.code);
      await setUserSetting(currentUserId, CURRENCY_SYMBOL_KEY, info.symbol);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
            <DollarSign size={22} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              Currency
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              Choose the currency for displaying prices across the app
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl bg-surface-container/50 px-4 py-3 text-center">
          <p className="text-xs text-on-surface-variant/60">Preview</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-on-surface">
            {currencySymbol}{(1234.56).toLocaleString(
              currencyInfo[currencyCode]?.locale ?? "en-US",
              { style: "currency", currency: currencyCode }
            ).replace(/[^\d,.\s]/g, "")}
          </p>
          <p className="text-[10px] text-on-surface-variant/40">
            {currencyCode} — {currencySymbol}1,234.56
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {currencyOptions.map(({ code, symbol, label }) => {
            const isActive = currencyCode === code;
            return (
              <button
                key={code}
                onClick={() => handleSelect(code)}
                disabled={saving}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                  isActive
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-outline-variant/40 bg-surface-container/30 hover:bg-surface-container/60"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold",
                    isActive
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-surface-container-high text-on-surface-variant"
                  )}
                >
                  {symbol}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isActive ? "text-emerald-400" : "text-on-surface"
                    )}
                  >
                    {code}
                  </p>
                  <p className="text-[10px] text-on-surface-variant/60">
                    {symbol}
                  </p>
                </div>
                {isActive && (
                  <Check size={14} className="shrink-0 text-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
