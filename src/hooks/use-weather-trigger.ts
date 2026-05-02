"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { getUserSetting, setUserSetting } from "@/lib/db";
import type { NotificationConfig, NotificationEngine } from "@/lib/notification-engine";

/**
 * Thresholds for built-in weather-based alerts.
 */
const FROST_TEMP_C = 2; // Trigger below 2°C
const HEATWAVE_TEMP_C = 38; // Trigger above 38°C
const STORM_CONDITIONS = new Set(["Thunderstorm", "Squall", "Tornado"]);

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const HYSTERESIS_BUFFER_C = 1; // 1°C buffer

// ── Persisted cooldown helpers ──

/**
 * Cooldown key prefix used in IndexedDB via setUserSetting/getUserSetting.
 * Example: cooldown:frost:40.7128:-74.0060:New York
 */
function cooldownSettingKey(alertKey: string): string {
  return `weatherCooldown:${alertKey}`;
}

/**
 * Hysteresis key prefix.
 * Example: hyst:tempAbove:40.7128:-74.0060:New York
 */
function hysteresisSettingKey(alertKey: string): string {
  return `weatherHyst:${alertKey}`;
}

/**
 * Returns true if the given alert key is still in its 6-hour cooldown window.
 */
async function isOnCooldown(userId: string, alertKey: string): Promise<boolean> {
  const raw = await getUserSetting(userId, cooldownSettingKey(alertKey));
  if (!raw) return false;
  const lastSent = parseInt(raw, 10);
  if (isNaN(lastSent)) return false;
  return Date.now() - lastSent < COOLDOWN_MS;
}

/**
 * Records that an alert was just sent so the cooldown timer starts now.
 */
async function markAlertSent(userId: string, alertKey: string): Promise<void> {
  await setUserSetting(userId, cooldownSettingKey(alertKey), String(Date.now()));
}

/**
 * For temperature-above thresholds, the alert is "cleared" (re-alert eligible)
 * only when the temp has dropped below (threshold - HYSTERESIS_BUFFER_C).
 * Returns true if the alert should actually fire now.
 */
async function shouldFireTempAbove(
  userId: string,
  alertKey: string,
  temp: number,
  threshold: number,
): Promise<boolean> {
  const clearedBelow = threshold - HYSTERESIS_BUFFER_C;
  // Always fire if temp is still above threshold – we rely on the cooldown for spam protection.
  // But we track whether the temp ever dropped below the buffer zone (the "cleared" state).
  const raw = await getUserSetting(userId, hysteresisSettingKey(alertKey));
  if (!raw) {
    // No hysteresis state yet — this is the first breach.
    // Record the threshold we are watching.
    await setUserSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }

  const recordedThreshold = parseFloat(raw);
  if (isNaN(recordedThreshold)) return true;

  // If temp has dropped below clearedBelow, mark as cleared and allow re-alert
  if (temp < clearedBelow) {
    // Cleared — re-alert will be allowed (cooldown permitting)
    // Delete the hyst key so next breach starts fresh
    await setUserSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }

  // Not yet cleared — suppress the alert (cooldown alone isn't enough)
  return false;
}

/**
 * For temperature-below thresholds, the alert is "cleared" only
 * when the temp has risen above (threshold + HYSTERESIS_BUFFER_C).
 */
async function shouldFireTempBelow(
  userId: string,
  alertKey: string,
  temp: number,
  threshold: number,
): Promise<boolean> {
  const clearedAbove = threshold + HYSTERESIS_BUFFER_C;
  const raw = await getUserSetting(userId, hysteresisSettingKey(alertKey));
  if (!raw) {
    await setUserSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }

  const recordedThreshold = parseFloat(raw);
  if (isNaN(recordedThreshold)) return true;

  // If temp has risen above clearedAbove, mark as cleared and allow re-alert
  if (temp > clearedAbove) {
    await setUserSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }

  return false;
}

/**
 * Formats a weather reading timestamp for the notification body.
 * Uses OpenWeather's dt_txt (YYYY-MM-DD HH:mm:ss) when available,
 * otherwise formats the Unix dt field.
 */
function formatReadingTime(current: any): string {
  if (current.dt_txt) {
    return current.dt_txt;
  }
  if (current.dt) {
    return new Date(current.dt * 1000).toLocaleString();
  }
  return new Date().toLocaleString();
}

/**
 * Hook that monitors weather data and sends alerts when extreme
 * weather conditions are detected.
 *
 * Supports both built-in alerts (frost, heatwave, storm) and
 * user-configurable forecast alert rules (temperature above/below
 * thresholds, rain in forecast window).
 *
 * Alerts are subject to a 6-hour cooldown persisted to IndexedDB,
 * and configurable threshold alerts have a 1°C hysteresis buffer
 * to prevent rapid re-triggering when temperature oscillates near
 * the boundary.
 */
export function useWeatherTrigger() {
  const weatherData = useAppStore((s) => s.weatherData);
  const weatherLocationHash = useAppStore((s) => s.weatherLocationHash);
  const currentUserId = useAppStore((s) => s.currentUserId);

  // In-memory dedup within a single render cycle (additional guard)
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
        const readingTime = formatReadingTime(current);

        const alerts: { title: string; body: string; priority: number; key: string }[] = [];

        // ── Built-in alerts ──

        // Frost alert
        if (temp <= FROST_TEMP_C) {
          alerts.push({
            title: "❄️ Frost Warning",
            body: `Frost conditions detected in ${cityName}! Temperature is ${Math.round(temp)}°C (at ${readingTime}). Protect your sensitive plants by moving them indoors or covering them.`,
            priority: 9,
            key: `frost:${weatherLocationHash}`,
          });
        }

        // Heatwave alert
        if (temp >= HEATWAVE_TEMP_C) {
          alerts.push({
            title: "☀️ Extreme Heat Alert",
            body: `Heatwave conditions in ${cityName}! Temperature is ${Math.round(temp)}°C (at ${readingTime}). Ensure your plants are well-watered and consider providing shade.`,
            priority: 9,
            key: `heatwave:${weatherLocationHash}`,
          });
        }

        // Storm alert
        if (STORM_CONDITIONS.has(condition)) {
          alerts.push({
            title: "⛈️ Storm Alert",
            body: `Storm detected in ${cityName} (at ${readingTime})! Current conditions: ${description}. Bring potted plants indoors and secure your garden.`,
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
              body: `Temperature in ${cityName} is ${Math.round(temp)}°C (at ${readingTime}), which exceeds your threshold of ${threshold}°C. Current conditions: ${description}.`,
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
              body: `Temperature in ${cityName} is ${Math.round(temp)}°C (at ${readingTime}), which is below your threshold of ${threshold}°C. Current conditions: ${description}.`,
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
          // In-memory guard (same render cycle)
          if (sentAlerts.current.has(alert.key)) continue;

          // Persisted cooldown guard (prevents repeat alerts across page refreshes)
          if (await isOnCooldown(currentUserId, alert.key)) continue;

          // Hysteresis guard for configurable temperature alerts
          if (alert.key.startsWith("tempAbove:")) {
            const threshold = parseFloat(tempAboveV ?? "0");
            if (!isNaN(threshold) && !(await shouldFireTempAbove(currentUserId, alert.key, temp, threshold))) continue;
          }
          if (alert.key.startsWith("tempBelow:")) {
            const threshold = parseFloat(tempBelowV ?? "0");
            if (!isNaN(threshold) && !(await shouldFireTempBelow(currentUserId, alert.key, temp, threshold))) continue;
          }

          sentAlerts.current.add(alert.key);
          await markAlertSent(currentUserId, alert.key);

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
