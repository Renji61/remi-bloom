"use client";

import { useState, useEffect } from "react";
import { Cloud, Key, Check, Loader2, MapPin } from "lucide-react";
import { Card, CardContent, Input, Button } from "@/components/ui";
import { CitySearch, type CityResult } from "./city-search";
import { getSetting, setSetting } from "@/lib/db";
import { useAppStore } from "@/stores/app-store";

export function WeatherConfig() {
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [apiKey, setApiKey] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const settingPrefix = currentUserId ? `${currentUserId}:` : "";

  useEffect(() => {
    async function load() {
      const key = await getSetting(`${settingPrefix}weatherApiKey`);
      const loc = await getSetting(`${settingPrefix}weatherLocation`);
      const lat = await getSetting(`${settingPrefix}weatherLat`);
      const lon = await getSetting(`${settingPrefix}weatherLon`);
      if (key) setApiKey(key);
      if (loc) {
        setLocationInput(loc);
        if (lat && lon) {
          setSelectedCity({
            name: loc.split(",")[0] || loc,
            country: loc.split(",").pop()?.trim() || "",
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            display: loc,
          });
        }
      }
      setLoaded(true);
    }
    load();
  }, [settingPrefix]);

  const handleCityChange = (city: CityResult | null) => {
    setSelectedCity(city);
    if (city) {
      setLocationInput(city.display);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    if (selectedCity) {
      await setSetting(`${settingPrefix}weatherLocation`, selectedCity.display);
      await setSetting(`${settingPrefix}weatherLat`, String(selectedCity.lat));
      await setSetting(`${settingPrefix}weatherLon`, String(selectedCity.lon));
    } else {
      const fallback = locationInput.trim() || "London";
      await setSetting(`${settingPrefix}weatherLocation`, fallback);
      await setSetting(`${settingPrefix}weatherLat`, "");
      await setSetting(`${settingPrefix}weatherLon`, "");
    }
    await setSetting(`${settingPrefix}weatherApiKey`, apiKey.trim());

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
            <Cloud size={22} className="text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              OpenWeather API
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              Get a free API key at openweathermap.org/api
            </p>
          </div>
        </div>

        <Input
          label="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your OpenWeather API key..."
        />

        <CitySearch
          apiKey={apiKey}
          value={locationInput}
          onChange={handleCityChange}
          label="Location (city name)"
          placeholder="e.g. London, Tokyo, New York..."
        />

        {selectedCity && (
          <div className="flex items-center gap-2 rounded-xl bg-surface-container/50 px-3 py-2">
            <MapPin size={12} className="text-[var(--theme-primary)]/60" />
            <span className="text-xs text-on-surface-variant/70">
              <span className="font-medium text-on-surface">{selectedCity.name}</span>
              {" — "}
              {selectedCity.lat.toFixed(2)}°N, {selectedCity.lon.toFixed(2)}°E
            </span>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : (
            <Key size={14} />
          )}
          {saved ? "Saved!" : "Save Weather Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
