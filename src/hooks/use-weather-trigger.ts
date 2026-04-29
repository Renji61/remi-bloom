"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { getSetting } from "@/lib/db";
import type { NotificationConfig, NotificationEngine } from "@/lib/notification-engine";

/**
 * Thresholds for weather-based alerts.
 */
const FROST_TEMP_C = 2; // Trigger below 2°C
const HEATWAVE_TEMP_C = 38; // Trigger above 38°C
const STORM_CONDITIONS = new Set(["Thunderstorm", "Squall", "Tornado"]);

/**
 * Hook that monitors weather data and sends alerts when extreme
 * weather conditions are detected.
 *
 * This only fires once per weather data change to avoid spamming
 * the notification service.
 */
export function useWeatherTrigger() {
  const weatherData = useAppStore((s) => s.weatherData);
  const weatherLocationHash = useAppStore((s) => s.weatherLocationHash);
  const currentUserId = useAppStore((s) => s.currentUserId);

  // Track which alerts have already been sent so we don't spam
  const sentAlerts = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!weatherData?.list?.length) return;

    (async () => {
      try {
        const prefix = currentUserId ? `${currentUserId}:` : "";
        const [engineVal, urlVal, tokenVal, weatherEnabled] = await Promise.all([
          getSetting(`${prefix}notificationEngine`),
          getSetting(`${prefix}notificationUrl`),
          getSetting(`${prefix}notificationToken`),
          getSetting(`${prefix}useWeatherAlerts`),
        ]);

        if (!weatherEnabled || weatherEnabled !== "true") return;
        if (!engineVal || engineVal === "disabled") return;
        if (!urlVal) return;

        const config: NotificationConfig = {
          engine: engineVal as NotificationEngine,
          url: urlVal,
          token: tokenVal ?? "",
          useWeatherAlerts: true,
          useCareAlerts: false,
        };

        const current = weatherData.list[0];
        const temp = current.main.temp;
        const condition = current.weather[0]?.main ?? "";
        const cityName = weatherData.city?.name ?? "Unknown";
        const description = current.weather[0]?.description ?? "";

        const alerts: { title: string; body: string; priority: number; key: string }[] = [];

        // Frost alert
        if (temp <= FROST_TEMP_C) {
          alerts.push({
            title: "❄️ Frost Warning",
            body: `Frost conditions detected in ${cityName}! Temperature is ${Math.round(temp)}°C. Protect your sensitive plants by moving them indoors or covering them.`,
            priority: 9,
            key: `frost:${weatherLocationHash}`,
          });
        }

        // Heatwave alert
        if (temp >= HEATWAVE_TEMP_C) {
          alerts.push({
            title: "☀️ Extreme Heat Alert",
            body: `Heatwave conditions in ${cityName}! Temperature is ${Math.round(temp)}°C. Ensure your plants are well-watered and consider providing shade.`,
            priority: 9,
            key: `heatwave:${weatherLocationHash}`,
          });
        }

        // Storm alert
        if (STORM_CONDITIONS.has(condition)) {
          alerts.push({
            title: "⛈️ Storm Alert",
            body: `Storm detected in ${cityName}! Current conditions: ${description}. Bring potted plants indoors and secure your garden.`,
            priority: 10,
            key: `storm:${weatherLocationHash}`,
          });
        }

        if (alerts.length === 0) return;

        const { sendNotification } = await import("@/lib/notification-engine");

        for (const alert of alerts) {
          // Only send each type of alert once per weather data refresh
          if (sentAlerts.current.has(alert.key)) continue;
          sentAlerts.current.add(alert.key);

          await sendNotification(config, {
            title: alert.title,
            body: alert.body,
            priority: alert.priority,
          });
        }
      } catch {
        // Silently fail — notifications are best-effort
      }
    })();
  }, [weatherData, weatherLocationHash]);
}
