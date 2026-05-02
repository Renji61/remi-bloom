"use client";

import { Sun, Moon, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Bell } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { getUserSetting } from "@/lib/db";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

function getWeatherIcon(main: string, size = 16) {
  switch (main) {
    case "Clear":
      return <Sun size={size} className="text-amber-400" aria-hidden="true" />;
    case "Clouds":
      return <Cloud size={size} className="text-on-surface-variant" aria-hidden="true" />;
    case "Rain":
      return <CloudRain size={size} className="text-blue-400" aria-hidden="true" />;
    case "Snow":
      return <CloudSnow size={size} className="text-sky-200" aria-hidden="true" />;
    case "Thunderstorm":
      return <CloudLightning size={size} className="text-purple-400" aria-hidden="true" />;
    case "Drizzle":
      return <CloudDrizzle size={size} className="text-blue-300" aria-hidden="true" />;
    case "Atmosphere":
      return <Cloud size={size} className="text-on-surface-variant/60" aria-hidden="true" />;
    default:
      return null;
  }
}

export function WeatherBadge() {
  const weatherData = useAppStore((s) => s.weatherData);

  if (!weatherData?.list?.[0]) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-surface-container-high/60 px-2.5 py-1.5">
        <div className="flex items-center gap-1">
          <Cloud size={14} className="text-on-surface-variant/30" aria-hidden="true" />
          <span className="text-[10px] text-on-surface-variant/30">--°C</span>
        </div>
      </div>
    );
  }

  const current = weatherData.list[0];
  const main = current.weather[0]?.main ?? "";
  const temp = Math.round(current.main.temp);
  const cityName = weatherData.city?.name;

  return (
    <div
      className="flex items-center gap-2 rounded-xl bg-surface-container-high/60 px-2.5 py-1.5"
      aria-label={cityName ? `Weather in ${cityName}, ${temp}°C` : `Temperature ${temp}°C`}
    >
      <div className="flex items-center gap-1">
        {getWeatherIcon(main, 16)}
        <span className="text-xs font-semibold tabular-nums text-on-surface">
          {temp}°C
        </span>
      </div>
    </div>
  );
}

export function HeaderThemeToggle() {
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  const toggleTheme = () => {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high/60 text-on-surface-variant transition-colors hover:bg-surface-container-higher hover:text-on-surface"
      aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {themeMode === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
    </button>
  );
}

export function NotificationsBadge() {
  const router = useRouter();
  const actionItems = useAppStore((s) => s.actionItems);
  const reminders = useAppStore((s) => s.reminders);
  const todos = useAppStore((s) => s.todos);

  const unreadCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let count = 0;
    for (const a of actionItems) {
      if (!a.completed && a.date <= today) count++;
    }
    for (const r of reminders) {
      if (!r.completed) count++;
    }
    for (const t of todos) {
      if (!t.completed) count++;
    }
    return count;
  }, [actionItems, reminders, todos]);

  return (
    <button
      onClick={() => router.push("/notifications")}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high/60 text-on-surface-variant transition-colors hover:bg-surface-container-higher hover:text-on-surface"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
    >
      <Bell size={14} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[8px] font-bold text-white leading-none" aria-hidden="true">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

/**
 * App-wide weather data fetcher.
 * Mount this in the root layout so weather data is available
 * on every page without visiting /weather first.
 */
export function WeatherFetcher() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const weatherData = useAppStore((s) => s.weatherData);
  const setWeatherData = useAppStore((s) => s.setWeatherData);
  const weatherLastFetchedAt = useAppStore((s) => s.weatherLastFetchedAt);
  const weatherLocationHash = useAppStore((s) => s.weatherLocationHash);
  const setWeatherMeta = useAppStore((s) => s.setWeatherMeta);

  const CACHE_DURATION_MS = 3 * 60 * 60 * 1000;

  const [location, setLocation] = useState("auto:detect");
  const [weatherLat, setWeatherLat] = useState<string | null>(null);
  const [weatherLon, setWeatherLon] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const currentHash = useMemo(
    () => `${weatherLat ?? ""}:${weatherLon ?? ""}:${location}`,
    [weatherLat, weatherLon, location]
  );

  const isCacheValid =
    !!weatherData &&
    !!weatherLastFetchedAt &&
    weatherLocationHash === currentHash &&
    Date.now() - weatherLastFetchedAt < CACHE_DURATION_MS;

  const fetchWeather = useCallback(async (signal?: AbortSignal) => {
    try {
      let proxyUrl: string;
      if (weatherLat && weatherLon) {
        proxyUrl = `/api/weather/proxy?lat=${weatherLat}&lon=${weatherLon}`;
      } else {
        const q = location === "auto:detect" ? "London" : location;
        proxyUrl = `/api/weather/proxy?q=${encodeURIComponent(q)}`;
      }
      const res = await fetch(proxyUrl, { signal, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
        setWeatherMeta(Date.now(), currentHash);
      }
    } catch {
      // Silently fail — badge will show placeholder
    }
  }, [location, weatherLat, weatherLon, setWeatherData, setWeatherMeta, currentHash]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUserId) {
        setReady(true);
        return;
      }

      const [loc, lat, lon] = await Promise.all([
        getUserSetting(currentUserId, "weatherLocation"),
        getUserSetting(currentUserId, "weatherLat"),
        getUserSetting(currentUserId, "weatherLon"),
      ]);
      if (cancelled) return;
      setLocation(loc ?? "auto:detect");
      setWeatherLat(lat ?? null);
      setWeatherLon(lon ?? null);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [currentUserId]);

  useEffect(() => {
    if (!(ready && !isCacheValid)) return;
    fetchWeather(AbortSignal.timeout(10000));
  }, [ready, isCacheValid, fetchWeather]);

  return null; // This component does not render anything
}
