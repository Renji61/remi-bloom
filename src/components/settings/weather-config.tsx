"use client";

import { useState, useEffect } from "react";
import { Cloud, Check, Loader2, MapPin } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
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
              Weather Location
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              Set your city for weather alerts and forecasts
            </p>
          </div>
        </div>

        {!apiKey && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
            <p className="text-xs text-amber-400">
              Add your OpenWeather API key in{" "}
              <span className="font-semibold">Settings &gt; API Keys</span>{" "}
              to enable city search.
            </p>
          </div>
        )}

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
            <MapPin size={14} />
          )}
          {saved ? "Saved!" : "Save Location"}
        </Button>
      </CardContent>
    </Card>
  );
}
