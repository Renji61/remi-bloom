"use client";

import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Check, Loader2, Info } from "lucide-react";
import { Card, CardContent, Input, Button } from "@/components/ui";
import { getSetting, setSetting } from "@/lib/db";
import { useAppStore } from "@/stores/app-store";
import type { User } from "@/lib/db";

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch("/api/profile", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

/**
 * API Keys settings component.
 * Reads/writes per-user API keys from/to IndexedDB settings.
 */
export function ApiKeySettings() {
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [plantidKey, setPlantidKey] = useState("");
  const [perenualKey, setPerenualKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    async function load() {
      let userId = currentUserId;

      // Try to restore session if we don't have a userId yet
      if (!userId) {
        const session = await fetchCurrentUser();
        if (session) {
          const store = useAppStore.getState();
          store.setCurrentUser(session);
          userId = session.id;
        }
      }

      if (!userId) {
        setLoaded(true);
        return;
      }

      const [plantid, perenual] = await Promise.all([
        getSetting(`${userId}:plantidApiKey`),
        getSetting(`${userId}:perenualApiKey`),
      ]);

      setPlantidKey(plantid ?? "");
      setPerenualKey(perenual ?? "");
      setLoaded(true);
    }
    load();
  }, [currentUserId]);

  const handleSave = async () => {
    if (!currentUserId) return;
    setSaving(true);

    await Promise.all([
      setSetting(`${currentUserId}:plantidApiKey`, plantidKey.trim()),
      setSetting(`${currentUserId}:perenualApiKey`, perenualKey.trim()),
    ]);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
            <Key size={22} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              API Keys
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              Configure API keys for plant identification and weather
            </p>
          </div>
        </div>

        {/* Toggle show/hide all keys */}
        <button
          onClick={() => setShowKeys(!showKeys)}
          className="flex items-center gap-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
        >
          {showKeys ? <EyeOff size={14} /> : <Eye size={14} />}
          {showKeys ? "Hide API Keys" : "Show API Keys"}
        </button>

        {/* Plant.id API Key */}
        <Input
          label="Plant.id API Key"
          type={showKeys ? "text" : "password"}
          value={plantidKey}
          onChange={(e) => setPlantidKey(e.target.value)}
          placeholder="Enter your Plant.id API key..."
        />

        {/* Perenual API Key */}
        <Input
          label="Perenual API Key"
          type={showKeys ? "text" : "password"}
          value={perenualKey}
          onChange={(e) => setPerenualKey(e.target.value)}
          placeholder="Enter your Perenual API key..."
        />

        <div className="flex items-start gap-2 rounded-xl bg-surface-container/50 px-3 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0 text-on-surface-variant/60" />
          <p className="text-xs text-on-surface-variant/70 leading-relaxed">
            Keys set here override environment variables for your account only.
            Get a Plant.id key at{" "}
            <span className="text-[var(--theme-primary)]">plant.id</span> and a
            Perenual key at{" "}
            <span className="text-[var(--theme-primary)]">perenual.com</span>.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : (
            <Key size={14} />
          )}
          {saved ? "Saved!" : "Save API Keys"}
        </Button>
      </CardContent>
    </Card>
  );
}
