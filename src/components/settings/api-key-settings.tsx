"use client";

import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Check, Loader2, Info, Cloud, Lock } from "lucide-react";
import { Card, CardContent, Input, Button } from "@/components/ui";
import { getUserSetting, setUserSetting } from "@/lib/db";
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
 *
 * When API_KEYS_OVERRIDABLE is set to "false", the fields are shown
 * but disabled, and users must rely on server-configured env vars.
 */
export function ApiKeySettings() {
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [plantidKey, setPlantidKey] = useState("");
  const [perenualKey, setPerenualKey] = useState("");
  const [weatherKey, setWeatherKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Check whether user overrides are allowed (checked client-side on mount)
  const [overridable, setOverridable] = useState(true);

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

      // Check if API_KEYS_OVERRIDABLE is false
      // We expose this via a simple server endpoint to avoid client env exposure
      try {
        const res = await fetch("/api/settings/keys-config", { credentials: "include" });
        if (res.ok) {
          const config = await res.json();
          setOverridable(config.overridable !== false);
        }
      } catch {
        // Default to overridable if we can't reach the server
      }

      if (!userId) {
        setLoaded(true);
        return;
      }

      const [plantid, perenual, weather] = await Promise.all([
        getUserSetting(userId, "plantidApiKey"),
        getUserSetting(userId, "perenualApiKey"),
        getUserSetting(userId, "weatherApiKey"),
      ]);

      setPlantidKey(plantid ?? "");
      setPerenualKey(perenual ?? "");
      setWeatherKey(weather ?? "");
      setLoaded(true);
    }
    load();
  }, [currentUserId]);

  const handleSave = async () => {
    if (!currentUserId || !overridable) return;
    setError(null);

    // Validate API key formats
    if (plantidKey.trim() && plantidKey.trim().length < 10) {
      setError("Plant.id API key appears invalid (too short)");
      return;
    }
    if (perenualKey.trim() && perenualKey.trim().length < 10) {
      setError("Perenual API key appears invalid (too short)");
      return;
    }

    setSaving(true);

    await Promise.all([
      setUserSetting(currentUserId, "plantidApiKey", plantidKey.trim()),
      setUserSetting(currentUserId, "perenualApiKey", perenualKey.trim()),
      setUserSetting(currentUserId, "weatherApiKey", weatherKey.trim()),
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

        {!overridable && (
          <div className="flex items-start gap-2 rounded-xl bg-surface-container/50 px-3 py-2.5">
            <Lock size={14} className="mt-0.5 shrink-0 text-amber-400" />
            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
              Custom API keys are currently disabled by the server administrator.
              Set <code className="text-[var(--theme-primary)] text-[10px]">API_KEYS_OVERRIDABLE=true</code> in the server environment to allow users to enter their own keys.
            </p>
          </div>
        )}

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
          disabled={!overridable}
        />

        {/* Perenual API Key */}
        <Input
          label="Perenual API Key"
          type={showKeys ? "text" : "password"}
          value={perenualKey}
          onChange={(e) => setPerenualKey(e.target.value)}
          placeholder="Enter your Perenual API key..."
          disabled={!overridable}
        />

        {/* OpenWeather API Key */}
        <div className="flex items-center gap-2 pt-1">
          <Cloud size={14} className="text-sky-400" />
          <span className="text-xs font-semibold text-on-surface-variant/80">OpenWeather</span>
        </div>
        <Input
          label="OpenWeather API Key"
          type={showKeys ? "text" : "password"}
          value={weatherKey}
          onChange={(e) => setWeatherKey(e.target.value)}
          placeholder="Enter your OpenWeather API key..."
          disabled={!overridable}
        />

        <div className="flex items-start gap-2 rounded-xl bg-surface-container/50 px-3 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0 text-on-surface-variant/60" />
          <p className="text-xs text-on-surface-variant/70 leading-relaxed">
            Keys set here override environment variables for your account only.
            Get a Plant.id key at{" "}
            <span className="text-[var(--theme-primary)]">plant.id</span>,
            a Perenual key at{" "}
            <span className="text-[var(--theme-primary)]">perenual.com</span>,
            and an OpenWeather key at{" "}
            <span className="text-[var(--theme-primary)]">openweathermap.org</span>.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <Button onClick={handleSave} disabled={saving || !overridable} className="w-full">
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
