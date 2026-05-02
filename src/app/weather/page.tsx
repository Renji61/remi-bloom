"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Wind,
  Thermometer,
  Droplets,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { CitySearch, type CityResult } from "@/components/settings/city-search";
import { useAppStore } from "@/stores/app-store";
import { getUserSetting, setUserSetting } from "@/lib/db";

type WeatherCondition =
  | "Clear"
  | "Clouds"
  | "Rain"
  | "Snow"
  | "Thunderstorm"
  | "Drizzle"
  | "Atmosphere";

interface ForecastItem {
  dt: number;
  dt_txt: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
    pressure: number;
  };
  weather: {
    id: number;
    main: WeatherCondition;
    description: string;
    icon: string;
  }[];
  wind: {
    speed: number;
    deg: number;
  };
}

interface WeatherData {
  city: { name: string; country: string };
  list: ForecastItem[];
}

function getWeatherIcon(main: WeatherCondition, size = 24): React.ReactNode {
  const props = { size, className: "text-on-surface-variant" };
  switch (main) {
    case "Clear":
      return <Sun {...props} className="text-amber-500" size={size} />;
    case "Clouds":
      return <Cloud {...props} className="text-on-surface-variant" size={size} />;
    case "Rain":
      return <CloudRain {...props} className="text-blue-500" size={size} />;
    case "Snow":
      return <CloudSnow {...props} className="text-sky-500" size={size} />;
    case "Thunderstorm":
      return <CloudLightning {...props} className="text-purple-500" size={size} />;
    case "Drizzle":
      return <CloudDrizzle {...props} className="text-blue-500" size={size} />;
    case "Atmosphere":
      return <Cloud {...props} className="text-on-surface-variant/60" size={size} />;
    default:
      return <Cloud {...props} size={size} />;
  }
}

function formatTemp(temp: number): string {
  return `${Math.round(temp)}°C`;
}

function formatDate(dateStr: string): string {
  // dt_txt comes as "2024-01-15 12:00:00" — convert to ISO
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function groupByDate(items: ForecastItem[]): ForecastItem[] {
  const seen = new Set<string>();
  const result: ForecastItem[] = [];
  for (const item of items) {
    const date = item.dt_txt.split(" ")[0];
    if (!seen.has(date)) {
      seen.add(date);
      result.push(item);
    }
  }
  return result;
}

export default function WeatherPage() {
  usePageTitle("Weather");
  const currentUserId = useAppStore((s) => s.currentUserId);
  const weatherData = useAppStore((s) => s.weatherData);
  const setWeatherData = useAppStore((s) => s.setWeatherData);
  const weatherLastFetchedAt = useAppStore((s) => s.weatherLastFetchedAt);
  const weatherLocationHash = useAppStore((s) => s.weatherLocationHash);
  const setWeatherMeta = useAppStore((s) => s.setWeatherMeta);

  const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [location, setLocation] = useState<string>("auto:detect");
  const [weatherLat, setWeatherLat] = useState<string | null>(null);
  const [weatherLon, setWeatherLon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // City search state
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const [savingCity, setSavingCity] = useState(false);
  const [citySaved, setCitySaved] = useState(false);

  const handleCityChange = (city: CityResult | null) => {
    setSelectedCity(city);
  };

  const handleCitySave = async () => {
    if (!currentUserId || !selectedCity) return;
    setSavingCity(true);
    await Promise.all([
      setUserSetting(currentUserId, "weatherLocation", selectedCity.display),
      setUserSetting(currentUserId, "weatherLat", String(selectedCity.lat)),
      setUserSetting(currentUserId, "weatherLon", String(selectedCity.lon)),
    ]);
    setWeatherLat(String(selectedCity.lat));
    setWeatherLon(String(selectedCity.lon));
    setLocation(selectedCity.display);
    setSavingCity(false);
    setCitySaved(true);
    setTimeout(() => setCitySaved(false), 2000);
    // Re-fetch weather for the new location
    fetchWeather();
  };

  // Forecast alert rule settings
  const [tempAboveEnabled, setLocalTempAbove] = useState(false);
  const [tempAboveValue, setLocalTempAboveValue] = useState("");
  const [tempBelowEnabled, setLocalTempBelow] = useState(false);
  const [tempBelowValue, setLocalTempBelowValue] = useState("");
  const [rainEnabled, setLocalRain] = useState(false);
  const [rainWindowHours, setLocalRainWindow] = useState("24");

  // Compute a hash of the current location to detect changes
  const currentLocationHash = useMemo(
    () => `${weatherLat ?? ""}:${weatherLon ?? ""}:${location}`,
    [weatherLat, weatherLon, location],
  );

  const isCacheValid = useMemo(() => {
    if (!weatherData || !weatherLastFetchedAt) return false;
    if (weatherLocationHash !== currentLocationHash) return false;
    return Date.now() - weatherLastFetchedAt < CACHE_DURATION_MS;
  }, [weatherData, weatherLastFetchedAt, weatherLocationHash, currentLocationHash]);

  const fetchWeather = useCallback(async (signal?: AbortSignal) => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);

    try {
      let url: string;
      if (weatherLat && weatherLon) {
        url = `https://api.openweathermap.org/data/2.5/forecast?lat=${weatherLat}&lon=${weatherLon}&appid=${apiKey}&units=metric`;
      } else {
        const queryLocation = location === "auto:detect" ? "London" : location;
        url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(queryLocation)}&appid=${apiKey}&units=metric`;
      }
      const res = await fetch(url, { signal });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Weather API error (${res.status}): ${errBody}`);
      }
      const data: WeatherData = await res.json();
      setWeatherData(data);
      setWeatherMeta(Date.now(), currentLocationHash);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Failed to fetch weather data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, location, weatherLat, weatherLon, setWeatherData, setWeatherMeta, currentLocationHash]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      if (!currentUserId) {
        setSettingsLoaded(true);
        return;
      }

      const [key, loc, lat, lon] = await Promise.all([
        getUserSetting(currentUserId, "weatherApiKey"),
        getUserSetting(currentUserId, "weatherLocation"),
        getUserSetting(currentUserId, "weatherLat"),
        getUserSetting(currentUserId, "weatherLon"),
      ]);
      if (cancelled) return;
      setApiKey(key ?? null);
      setLocation(loc ?? "auto:detect");
      setWeatherLat(lat ?? null);
      setWeatherLon(lon ?? null);

      // Load forecast alert rule settings
      const [
        tempAboveE, tempAboveV, tempBelowE, tempBelowV,
        rainE, rainW,
      ] = await Promise.all([
        getUserSetting(currentUserId, "weatherAlertTempAboveEnabled"),
        getUserSetting(currentUserId, "weatherAlertTempAboveValue"),
        getUserSetting(currentUserId, "weatherAlertTempBelowEnabled"),
        getUserSetting(currentUserId, "weatherAlertTempBelowValue"),
        getUserSetting(currentUserId, "weatherAlertRainEnabled"),
        getUserSetting(currentUserId, "weatherAlertRainWindowHours"),
      ]);
      if (cancelled) return;
      setLocalTempAbove(tempAboveE === "true");
      setLocalTempAboveValue(tempAboveV ?? "");
      setLocalTempBelow(tempBelowE === "true");
      setLocalTempBelowValue(tempBelowV ?? "");
      setLocalRain(rainE === "true");
      setLocalRainWindow(rainW ?? "24");

      setSettingsLoaded(true);
    }
    loadSettings();
    return () => { cancelled = true; };
  }, [currentUserId]);

  // Auto-fetch on mount only if cache is stale or missing
  useEffect(() => {
    if (!(settingsLoaded && apiKey && !isCacheValid)) return;
    fetchWeather(AbortSignal.timeout(10000));
  }, [settingsLoaded, apiKey, isCacheValid, fetchWeather]);

  const currentWeather: ForecastItem | null = weatherData?.list?.[0] ?? null;
  const cityName = weatherData?.city?.name ?? null;
  const forecasts = weatherData?.list ? groupByDate(weatherData.list).slice(0, 5) : [];

  // ----- Render -----

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            {cityName ? `Current conditions for ${cityName}` : "Real-time weather for your garden"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchWeather()}
            disabled={loading || !apiKey}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {/* City Location Picker — always visible when settings are loaded */}
      {settingsLoaded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-[var(--theme-primary)]/60" />
              <span className="text-xs font-semibold text-on-surface-variant/80">
                Location
              </span>
            </div>
            <CitySearch
              apiKey={apiKey ?? ""}
              value={selectedCity?.display ?? location}
              onChange={handleCityChange}
              placeholder="Search for a city..."
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
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleCitySave}
                disabled={savingCity || !selectedCity}
              >
                {savingCity ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : citySaved ? (
                  <MapPin size={14} />
                ) : (
                  <MapPin size={14} />
                )}
                {citySaved ? "Saved!" : "Set Location"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!settingsLoaded ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-on-surface-variant/50" />
        </div>
      ) : !apiKey ? (
        /* No API Key state */
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
              <Thermometer size={24} className="text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-on-surface">Weather API Key Required</h2>
            <p className="mt-2 text-xs text-on-surface-variant/70 leading-relaxed max-w-sm mx-auto">
              To use the weather feature, add your OpenWeather API key in Settings.
              You can get a free key at <span className="text-[var(--theme-primary)]">openweathermap.org</span>.
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => window.location.href = "/settings"}
            >
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      ) : loading && !weatherData ? (
        /* Initial loading state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <RefreshCw size={32} className="mb-3 animate-spin text-on-surface-variant/50" />
          <p className="text-sm font-medium text-on-surface-variant">Fetching weather data...</p>
        </div>
      ) : error ? (
        /* Error state */
        <Card>
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
              <Cloud size={22} className="text-red-400" />
            </div>
            <h2 className="text-sm font-semibold text-on-surface">Unable to Load Weather</h2>
            <p className="mt-1 text-xs text-on-surface-variant/70">{error}</p>
            <Button className="mt-4" size="sm" onClick={() => fetchWeather()}>
              <RefreshCw size={14} />
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : currentWeather ? (
        <>
          {/* Current Weather Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-[var(--theme-primary)]" />
                      <h2 className="text-sm font-semibold text-on-surface truncate">{cityName}</h2>
                    </div>
                    <p className="mt-0.5 text-xs text-on-surface-variant/60 capitalize">
                      {currentWeather.weather[0]?.description ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getWeatherIcon(currentWeather.weather[0]?.main ?? "Clouds", 36)}
                    <span className="text-3xl font-bold tabular-nums text-on-surface">
                      {formatTemp(currentWeather.main.temp)}
                    </span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-surface-container/60 p-3 text-center">
                    <Thermometer size={16} className="mx-auto text-on-surface-variant/50" />
                    <p className="mt-1 text-[10px] text-on-surface-variant/60">Feels Like</p>
                    <p className="text-sm font-semibold tabular-nums text-on-surface">
                      {formatTemp(currentWeather.main.feels_like)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface-container/60 p-3 text-center">
                    <Droplets size={16} className="mx-auto text-blue-500/60" />
                    <p className="mt-1 text-[10px] text-on-surface-variant/60">Humidity</p>
                    <p className="text-sm font-semibold tabular-nums text-on-surface">
                      {currentWeather.main.humidity}%
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface-container/60 p-3 text-center">
                    <Wind size={16} className="mx-auto text-on-surface-variant/50" />
                    <p className="mt-1 text-[10px] text-on-surface-variant/60">Wind</p>
                    <p className="text-sm font-semibold tabular-nums text-on-surface">
                      {Math.round(currentWeather.wind.speed)} m/s
                    </p>
                  </div>
                </div>

                {/* Min / Max */}
                <div className="mt-3 flex items-center justify-center gap-4 rounded-2xl bg-surface-container/40 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-blue-500">↓</span>
                    <span className="text-xs tabular-nums text-on-surface-variant">
                      {formatTemp(currentWeather.main.temp_min)}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-outline/10" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-amber-500">↑</span>
                    <span className="text-xs tabular-nums text-on-surface-variant">
                      {formatTemp(currentWeather.main.temp_max)}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-outline/10" />
                  <div className="text-[10px] text-on-surface-variant/50">
                    {currentWeather.main.temp > currentWeather.main.feels_like
                      ? "Feels cooler"
                      : currentWeather.main.temp < currentWeather.main.feels_like
                        ? "Feels warmer"
                        : "Matches feels"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 5-Day Forecast */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-on-surface-variant/70">
              5-Day Forecast
            </h3>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-5 min-w-[400px] sm:min-w-0">
              {forecasts.map((item, i) => (
                <motion.div
                  key={item.dt}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-[10px] font-semibold text-on-surface-variant/60">
                        {i === 0 ? "Today" : formatDate(item.dt_txt)}
                      </p>
                      <div className="my-2 flex justify-center">
                        {getWeatherIcon(item.weather[0]?.main ?? "Clouds", 22)}
                      </div>
                      <p className="text-sm font-bold tabular-nums text-on-surface">
                        {formatTemp(item.main.temp)}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span className="text-[9px] text-blue-400/60">↓{formatTemp(item.main.temp_min)}</span>
                        <span className="text-[9px] text-amber-400/60">↑{formatTemp(item.main.temp_max)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Forecast Alert Rules Card */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Thermometer size={16} className="text-[var(--theme-primary)]/60" />
              <h3 className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
                Forecast Alert Rules
              </h3>
            </div>

            {/* Temperature Above */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tempAboveEnabled}
                onChange={(e) => {
                  setLocalTempAbove(e.target.checked);
                  if (currentUserId) {
                    setUserSetting(currentUserId, "weatherAlertTempAboveEnabled", String(e.target.checked));
                  }
                }}
                className="h-4 w-4 rounded border-outline/30 bg-surface-container/60 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]/30"
              />
              <div className="flex-1">
                <span className="text-sm text-on-surface">Temperature above</span>
              </div>
            </label>
            {tempAboveEnabled && (
              <div className="pl-7">
                <Input
                  label="Threshold (°C)"
                  type="number"
                  value={tempAboveValue}
                  onChange={(e) => {
                    setLocalTempAboveValue(e.target.value);
                    if (currentUserId) {
                      setUserSetting(currentUserId, "weatherAlertTempAboveValue", e.target.value);
                    }
                  }}
                  placeholder="e.g. 35"
                />
              </div>
            )}

            {/* Temperature Below */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tempBelowEnabled}
                onChange={(e) => {
                  setLocalTempBelow(e.target.checked);
                  if (currentUserId) {
                    setUserSetting(currentUserId, "weatherAlertTempBelowEnabled", String(e.target.checked));
                  }
                }}
                className="h-4 w-4 rounded border-outline/30 bg-surface-container/60 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]/30"
              />
              <div className="flex-1">
                <span className="text-sm text-on-surface">Temperature below</span>
              </div>
            </label>
            {tempBelowEnabled && (
              <div className="pl-7">
                <Input
                  label="Threshold (°C)"
                  type="number"
                  value={tempBelowValue}
                  onChange={(e) => {
                    setLocalTempBelowValue(e.target.value);
                    if (currentUserId) {
                      setUserSetting(currentUserId, "weatherAlertTempBelowValue", e.target.value);
                    }
                  }}
                  placeholder="e.g. 0"
                />
              </div>
            )}

            {/* Rain Alert */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rainEnabled}
                onChange={(e) => {
                  setLocalRain(e.target.checked);
                  if (currentUserId) {
                    setUserSetting(currentUserId, "weatherAlertRainEnabled", String(e.target.checked));
                  }
                }}
                className="h-4 w-4 rounded border-outline/30 bg-surface-container/60 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]/30"
              />
              <div className="flex-1">
                <span className="text-sm text-on-surface">Rain alert</span>
              </div>
            </label>
            {rainEnabled && (
              <div className="pl-7">
                <Input
                  label="Forecast window (hours)"
                  type="number"
                  min={1}
                  value={rainWindowHours}
                  onChange={(e) => {
                    setLocalRainWindow(e.target.value);
                    if (currentUserId) {
                      setUserSetting(currentUserId, "weatherAlertRainWindowHours", e.target.value);
                    }
                  }}
                  placeholder="24"
                />
              </div>
            )}
          </CardContent>
        </Card>
        </>
      ) : (
        /* Empty state — should not normally happen when apiKey is set */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Cloud size={40} className="mb-3 text-on-surface-variant/50" />
          <p className="text-sm font-medium text-on-surface-variant">No weather data</p>
          <Button className="mt-4" size="sm" onClick={() => fetchWeather()}>
            <RefreshCw size={14} />
            Fetch Weather
          </Button>
        </div>
      )}
    </div>
  );
}
