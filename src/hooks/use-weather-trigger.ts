"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { getUserSetting } from "@/lib/db";
import type { NotificationConfig, NotificationEngine } from "@/lib/notification-engine";

/**
 * Thresholds for built-in weather-based alerts.
 */
const FROST_TEMP_C = 2; // Trigger below 2°C
const HEATWAVE_TEMP_C = 38; // Trigger above 38°C
const STORM_CONDITIONS = new Set(["Thunderstorm", "Squall", "Tornado"]);

/**
 * Hook that monitors weather data and sends alerts when extreme
 * weather conditions are detected.
 *
 * Supports both built-in alerts (frost, heatwave, storm) and
 * user-configurable forecast alert rules (temperature above/below
 * thresholds, rain in forecast window).
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
        if (!currentUserId) return;

        const [engineVal, urlVal, tokenVal, weatherEnabled] = await Promise.all([
          getUserSetting(currentUserId, "notificationEngine"),
          getUserSetting(currentUserId, "notificationUrl"),
          getUserSetting(currentUserId, "notificationToken"),
          getUserSetting(currentUserId, "useWeatherAlerts"),
        ]);

        if (!weatherEnabled || weatherEnabled !== "true") return;
        if (!engineVal || engineVal === "disabled") return;
        if (!urlVal) return;

        // Load configurable alert rule settings
        const [
          tempAboveE, tempAboveV,
          tempBelowE, tempBelowV,
          rainE, rainW,
        ] = await Promise.all([
          getUserSetting(currentUserId, "weatherAlertTempAboveEnabled"),
          getUserSetting(currentUserId, "weatherAlertTempAboveValue"),
          getUserSetting(currentUserId, "weatherAlertTempBelowEnabled"),
          getUserSetting(currentUserId, "weatherAlertTempBelowValue"),
          getUserSetting(currentUserId, "weatherAlertRainEnabled"),
          getUserSetting(currentUserId, "weatherAlertRainWindowHours"),
        ]);

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

        // ── Built-in alerts ──

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

        // ── Configurable forecast alert rules ──

        // Temperature above threshold
        if (tempAboveE === "true" && tempAboveV) {
          const threshold = parseFloat(tempAboveV);
          if (!isNaN(threshold) && temp > threshold) {
            alerts.push({
              title: "🔥 High Temperature Alert",
              body: `Temperature in ${cityName} is ${Math.round(temp)}°C, which exceeds your threshold of ${threshold}°C. Current conditions: ${description}.`,
              priority: 8,
              key: `tempAbove:${weatherLocationHash}`,
            });
          }
        }

        // Temperature below threshold
        if (tempBelowE === "true" && tempBelowV) {
          const threshold = parseFloat(tempBelowV);
          if (!isNaN(threshold) && temp < threshold) {
            alerts.push({
              title: "❄️ Low Temperature Alert",
              body: `Temperature in ${cityName} is ${Math.round(temp)}°C, which is below your threshold of ${threshold}°C. Current conditions: ${description}.`,
              priority: 8,
              key: `tempBelow:${weatherLocationHash}`,
            });
          }
        }

        // Rain alert — scan forecast list for rain within the configured window
        if (rainE === "true") {
          const windowHours = parseInt(rainW || "24", 10);
          if (!isNaN(windowHours) && windowHours > 0) {
            const now = Math.floor(Date.now() / 1000);
            const windowEnd = now + windowHours * 3600;

            let rainFound = false;
            let earliestRainTime: string | null = null;

            for (const item of weatherData.list) {
              if (item.dt > windowEnd) break;
              const main = item.weather[0]?.main ?? "";
              const id = item.weather[0]?.id ?? 0;
              if (id >= 500 && id < 600 || main === "Rain" || main === "Drizzle" || main === "Thunderstorm") {
                rainFound = true;
                if (!earliestRainTime) {
                  earliestRainTime = item.dt_txt || new Date(item.dt * 1000).toLocaleString();
                }
              }
            }

            if (rainFound) {
              alerts.push({
                title: "🌧️ Rain Expected",
                body: `Rain expected in ${cityName} within the next ${windowHours} hours (earliest: ${earliestRainTime}). Consider adjusting your watering schedule and protecting sensitive plants.`,
                priority: 7,
                key: `rain:${weatherLocationHash}`,
              });
            }
          }
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
  }, [weatherData, weatherLocationHash, currentUserId]);
}
