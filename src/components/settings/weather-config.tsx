"use client";

import { useState, useEffect } from "react";
import { Cloud, Key, Check, Loader2, MapPin, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, Input, Button } from "@/components/ui";
import { CitySearch, type CityResult } from "./city-search";
import { getUserSetting, setUserSetting } from "@/lib/db";
import { useAppStore } from "@/stores/app-store";

export function WeatherConfig() {
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [apiKey, setApiKey] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    async function load() {
      if (!currentUserId) {
        setLoaded(true);
        return;
      }

      const [key, loc, lat, lon] = await Promise.all([
        getUserSetting(currentUserId, "weatherApiKey"),
        getUserSetting(currentUserId, "weatherLocation"),
        getUserSetting(currentUserId, "weatherLat"),
        getUserSetting(currentUserId, "weatherLon"),
      ]);
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
  }, [currentUserId]);

  const handleCityChange = (city: CityResult | null) => {
    setSelectedCity(city);
    if (city) {
      setLocationInput(city.display);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;
    setSaving(true);

    if (selectedCity) {
      await setUserSetting(currentUserId, "weatherLocation", selectedCity.display);
      await setUserSetting(currentUserId, "weatherLat", String(selectedCity.lat));
      await setUserSetting(currentUserId, "weatherLon", String(selectedCity.lon));
    } else {
      const fallback = locationInput.trim() || "London";
      await setUserSetting(currentUserId, "weatherLocation", fallback);
      await setUserSetting(currentUserId, "weatherLat", "");
      await setUserSetting(currentUserId, "weatherLon", "");
    }
    await setUserSetting(currentUserId, "weatherApiKey", apiKey.trim());

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

        {/* Toggle show/hide API key */}
        <button
          onClick={() => setShowKey(!showKey)}
          className="flex items-center gap-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
        >
          {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          {showKey ? "Hide API Key" : "Show API Key"}
        </button>

        <Input
          label="API Key"
          type={showKey ? "text" : "password"}
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
