import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { actionItems } from "@/db/schema/action-items";
import type { ActionRepeat } from "@/lib/db";
import { settings } from "@/db/schema/settings";
import { users } from "@/db/schema/auth";
import {
  sendServerNotification,
  type ServerNotificationConfig,
  type NotificationEngine,
} from "@/lib/server-notification-engine";
import { eq, and, sql } from "drizzle-orm";
import { computeNextDate } from "@/lib/repeat-utils";
import type { RepeatConfig } from "@/lib/db";

// ──────────────────────────────────────────────
// Constants (mirrors src/hooks/use-weather-trigger.ts)
// ──────────────────────────────────────────────

const FROST_TEMP_C = 2;
const HEATWAVE_TEMP_C = 38;
const STORM_CONDITIONS = new Set(["Thunderstorm", "Squall", "Tornado"]);
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const HYSTERESIS_BUFFER_C = 1; // 1°C buffer for temperature alerts

// ──────────────────────────────────────────────
// Helper: fetch a single user setting from PostgreSQL
// ──────────────────────────────────────────────

async function getSetting(userId: string, key: string): Promise<string | undefined> {
  const db = getDb();
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, `${userId}:${key}`))
    .then((r) => r[0]);
  return row?.value;
}

async function setSetting(userId: string, key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(settings)
    .values({ key: `${userId}:${key}`, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

function hysteresisSettingKey(alertKey: string): string {
  return `weatherHyst:${alertKey}`;
}

async function shouldFireTempAbove(
  userId: string,
  alertKey: string,
  temp: number,
  threshold: number,
): Promise<boolean> {
  const clearedBelow = threshold - HYSTERESIS_BUFFER_C;
  const raw = await getSetting(userId, hysteresisSettingKey(alertKey));

  if (!raw) {
    await setSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }
  const recordedThreshold = parseFloat(raw);
  if (isNaN(recordedThreshold)) return true;
  if (temp < clearedBelow) {
    await setSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }
  return false;
}

async function shouldFireTempBelow(
  userId: string,
  alertKey: string,
  temp: number,
  threshold: number,
): Promise<boolean> {
  const clearedAbove = threshold + HYSTERESIS_BUFFER_C;
  const raw = await getSetting(userId, hysteresisSettingKey(alertKey));

  if (!raw) {
    await setSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }
  const recordedThreshold = parseFloat(raw);
  if (isNaN(recordedThreshold)) return true;
  if (temp > clearedAbove) {
    await setSetting(userId, hysteresisSettingKey(alertKey), String(threshold));
    return true;
  }
  return false;
}

// ──────────────────────────────────────────────
// Helper: format a date string as YYYY-MM-DD
// (handles both ISO and PostgreSQL timestamp formats)
// ──────────────────────────────────────────────

function formatDateOnly(raw: string): string {
  return raw.split("T")[0].split(" ")[0];
}

// ──────────────────────────────────────────────
// Care reminder delivery
// ──────────────────────────────────────────────

async function processCareReminders(
  userId: string,
  config: ServerNotificationConfig,
): Promise<{ sent: number; errors: number }> {
  const db = getDb();
  const todayStr = new Date().toISOString().split("T")[0];
  let sent = 0;
  let errors = 0;

  // ── Action items ──

  const dueActions = await db
    .select({
      id: actionItems.id,
      userId: actionItems.userId,
      title: actionItems.title,
      date: actionItems.date,
      time: actionItems.time,
      note: actionItems.note,
      plantNames: actionItems.plantNames,
      repeat: actionItems.repeat,
      repeatConfig: actionItems.repeatConfig,
    })
    .from(actionItems)
    .where(
      and(
        eq(actionItems.userId, userId),
        eq(actionItems.completed, false),
        eq(actionItems.notificationSent, false),
        sql`DATE(${actionItems.date}) <= ${todayStr}`,
      ),
    );

  for (const item of dueActions) {
    const plantInfo =
      item.plantNames && item.plantNames.length > 0
        ? ` for ${item.plantNames.join(", ")}`
        : "";

    const result = await sendServerNotification(config, {
      title: `Care Task Due: ${item.title}`,
      body: `Task "${item.title}"${plantInfo} is due today (${formatDateOnly(item.date)}${item.time ? ` at ${item.time}` : ""}).${item.note ? `\n\nNote: ${item.note}` : ""}`,
      priority: 7,
    });

    if (result.success) {
      // Recurring action item: compute next due date
      if (item.repeat && item.repeat !== "none" && item.repeatConfig) {
        const nextDate = computeNextDate(
          item.repeat as ActionRepeat,
          item.repeatConfig as RepeatConfig,
          formatDateOnly(item.date),
        );
        if (nextDate) {
          await db
            .update(actionItems)
            .set({ date: nextDate + "T00:00:00", notificationSent: false })
            .where(eq(actionItems.id, item.id));
        } else {
          // Fall back to just marking sent
          await db
            .update(actionItems)
            .set({ notificationSent: true })
            .where(eq(actionItems.id, item.id));
        }
      } else {
        await db
          .update(actionItems)
          .set({ notificationSent: true })
          .where(eq(actionItems.id, item.id));
      }
      sent++;
    } else {
      errors++;
    }
  }

  return { sent, errors };
}

// ──────────────────────────────────────────────
// Weather alert delivery
// ──────────────────────────────────────────────

interface WeatherAlert {
  title: string;
  body: string;
  priority: number;
  key: string;
}

async function processWeatherAlerts(
  userId: string,
  config: ServerNotificationConfig,
): Promise<{ sent: number; errors: number }> {
  const [apiKey, lat, lon, location] = await Promise.all([
    getSetting(userId, "weatherApiKey"),
    getSetting(userId, "weatherLat"),
    getSetting(userId, "weatherLon"),
    getSetting(userId, "weatherLocation"),
  ]);

  if (!apiKey) return { sent: 0, errors: 0 };

  // Load configurable alert rule settings
  const [tempAboveE, tempAboveV, tempBelowE, tempBelowV, rainE, rainW] =
    await Promise.all([
      getSetting(userId, "weatherAlertTempAboveEnabled"),
      getSetting(userId, "weatherAlertTempAboveValue"),
      getSetting(userId, "weatherAlertTempBelowEnabled"),
      getSetting(userId, "weatherAlertTempBelowValue"),
      getSetting(userId, "weatherAlertRainEnabled"),
      getSetting(userId, "weatherAlertRainWindowHours"),
    ]);

  // Fetch weather data from OpenWeather
  let weatherUrl: string;
  if (lat && lon) {
    weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  } else if (location && location !== "auto:detect") {
    weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
  } else {
    // No location configured
    return { sent: 0, errors: 0 };
  }

  let weatherData: any;
  try {
    const res = await fetch(weatherUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { sent: 0, errors: 0 };
    weatherData = await res.json();
  } catch {
    return { sent: 0, errors: 0 };
  }

  if (!weatherData?.list?.length) return { sent: 0, errors: 0 };

  const current = weatherData.list[0];
  const temp = current.main.temp;
  const condition = current.weather[0]?.main ?? "";
  const cityName = weatherData.city?.name ?? "Unknown";
  const description = current.weather[0]?.description ?? "";
  const readingTime = current.dt_txt || new Date(current.dt * 1000).toLocaleString();

  const alerts: WeatherAlert[] = [];

  // ── Built-in alerts ──

  if (temp <= FROST_TEMP_C) {
    alerts.push({
      title: "❄️ Frost Warning",
      body: `Frost conditions detected in ${cityName}! Temperature is ${Math.round(temp)}°C (at ${readingTime}). Protect your sensitive plants by moving them indoors or covering them.`,
      priority: 9,
      key: `frost:${userId}`,
    });
  }

  if (temp >= HEATWAVE_TEMP_C) {
    alerts.push({
      title: "☀️ Extreme Heat Alert",
      body: `Heatwave conditions in ${cityName}! Temperature is ${Math.round(temp)}°C (at ${readingTime}). Ensure your plants are well-watered and consider providing shade.`,
      priority: 9,
      key: `heatwave:${userId}`,
    });
  }

  if (STORM_CONDITIONS.has(condition)) {
    alerts.push({
      title: "⛈️ Storm Alert",
      body: `Storm detected in ${cityName} (at ${readingTime})! Current conditions: ${description}. Bring potted plants indoors and secure your garden.`,
      priority: 10,
      key: `storm:${userId}`,
    });
  }

  // ── Configurable threshold alerts ──

  if (tempAboveE === "true" && tempAboveV) {
    const threshold = parseFloat(tempAboveV);
    if (!isNaN(threshold) && temp > threshold) {
      alerts.push({
        title: "🔥 High Temperature Alert",
        body: `Temperature in ${cityName} is ${Math.round(temp)}°C (at ${readingTime}), which exceeds your threshold of ${threshold}°C. Current conditions: ${description}.`,
        priority: 8,
        key: `tempAbove:${userId}:${threshold}`,
      });
    }
  }

  if (tempBelowE === "true" && tempBelowV) {
    const threshold = parseFloat(tempBelowV);
    if (!isNaN(threshold) && temp < threshold) {
      alerts.push({
        title: "❄️ Low Temperature Alert",
        body: `Temperature in ${cityName} is ${Math.round(temp)}°C (at ${readingTime}), which is below your threshold of ${threshold}°C. Current conditions: ${description}.`,
        priority: 8,
        key: `tempBelow:${userId}:${threshold}`,
      });
    }
  }

  // ── Rain alert ──

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
        if (
          (id >= 500 && id < 600) ||
          main === "Rain" ||
          main === "Drizzle" ||
          main === "Thunderstorm"
        ) {
          rainFound = true;
          if (!earliestRainTime) {
            earliestRainTime =
              item.dt_txt || new Date(item.dt * 1000).toLocaleString();
          }
        }
      }

      if (rainFound) {
        alerts.push({
          title: "🌧️ Rain Expected",
          body: `Rain expected in ${cityName} within the next ${windowHours} hours (earliest: ${earliestRainTime}). Consider adjusting your watering schedule and protecting sensitive plants.`,
          priority: 7,
          key: `rain:${userId}`,
        });
      }
    }
  }

  // ── Send alerts with cooldown check ──

  let sent = 0;
  let errors = 0;

  for (const alert of alerts) {
    // Check 6-hour cooldown
    const cooldownRaw = await getSetting(userId, `weatherCooldown:${alert.key}`);
    if (cooldownRaw) {
      const lastSent = parseInt(cooldownRaw, 10);
      if (!isNaN(lastSent) && Date.now() - lastSent < COOLDOWN_MS) {
        continue; // Still on cooldown
      }
    }

    // Hysteresis guard for configurable temperature alerts
    if (alert.key.startsWith("tempAbove:")) {
      const threshold = parseFloat(tempAboveV ?? "0");
      if (!isNaN(threshold) && !(await shouldFireTempAbove(userId, alert.key, temp, threshold))) continue;
    }
    if (alert.key.startsWith("tempBelow:")) {
      const threshold = parseFloat(tempBelowV ?? "0");
      if (!isNaN(threshold) && !(await shouldFireTempBelow(userId, alert.key, temp, threshold))) continue;
    }

    const result = await sendServerNotification(config, {
      title: alert.title,
      body: alert.body,
      priority: alert.priority,
    });

    if (result.success) {
      await setSetting(userId, `weatherCooldown:${alert.key}`, String(Date.now()));
      sent++;
    } else {
      errors++;
    }
  }

  return { sent, errors };
}

// ──────────────────────────────────────────────
// POST /api/cron/notifications
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Protect with a bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const allUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.active, true));

  const results: {
    userId: string;
    careSent: number;
    careErrors: number;
    weatherSent: number;
    weatherErrors: number;
  }[] = [];

  for (const user of allUsers) {
    try {
      const [engine, url, token, careEnabled, weatherEnabled] = await Promise.all([
        getSetting(user.id, "notificationEngine"),
        getSetting(user.id, "notificationUrl"),
        getSetting(user.id, "notificationToken"),
        getSetting(user.id, "useCareAlerts"),
        getSetting(user.id, "useWeatherAlerts"),
      ]);

      if (!engine || engine === "disabled" || !url) continue;

      const config: ServerNotificationConfig = {
        engine: engine as NotificationEngine,
        url,
        token: token ?? "",
      };

      let careSent = 0;
      let careErrors = 0;
      let weatherSent = 0;
      let weatherErrors = 0;

      if (careEnabled === "true") {
        const careResult = await processCareReminders(user.id, config);
        careSent = careResult.sent;
        careErrors = careResult.errors;
      }

      if (weatherEnabled === "true") {
        const weatherResult = await processWeatherAlerts(user.id, config);
        weatherSent = weatherResult.sent;
        weatherErrors = weatherResult.errors;
      }

      if (careSent > 0 || weatherSent > 0 || careErrors > 0 || weatherErrors > 0) {
        results.push({
          userId: user.id,
          careSent,
          careErrors,
          weatherSent,
          weatherErrors,
        });
      }
    } catch {
      // Per-user error should not break the entire cron run
      results.push({
        userId: user.id,
        careSent: 0,
        careErrors: 0,
        weatherSent: 0,
        weatherErrors: 0,
      });
    }
  }

  const totalCareSent = results.reduce((sum, r) => sum + r.careSent, 0);
  const totalCareErrors = results.reduce((sum, r) => sum + r.careErrors, 0);
  const totalWeatherSent = results.reduce((sum, r) => sum + r.weatherSent, 0);
  const totalWeatherErrors = results.reduce((sum, r) => sum + r.weatherErrors, 0);

  return NextResponse.json({
    success: true,
    usersProcessed: allUsers.length,
    summary: {
      careNotificationsSent: totalCareSent,
      careNotificationErrors: totalCareErrors,
      weatherAlertsSent: totalWeatherSent,
      weatherAlertErrors: totalWeatherErrors,
    },
    details: results,
  });
}

// Also accept GET for simpler cron tooling (some cron services only do GET)
export async function GET(request: NextRequest) {
  return POST(request);
}
