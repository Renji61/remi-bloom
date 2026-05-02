"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { getUserSetting } from "@/lib/db";
import type { NotificationConfig, NotificationEngine } from "@/lib/notification-engine";

/**
 * Hook that monitors the store for due action items, reminders, and todos
 * and sends notifications when care tasks become due.
 *
 * It fires once per minute (polling) and tracks what it has already sent
 * to avoid duplicate alerts.
 */
export function useReminderTrigger() {
  const actionItems = useAppStore((s) => s.actionItems);
  const reminders = useAppStore((s) => s.reminders);
  const todos = useAppStore((s) => s.todos);
  const currentUserId = useAppStore((s) => s.currentUserId);

  // Use refs so the polling interval doesn't reset on every array change
  const actionItemsRef = useRef(actionItems);
  const remindersRef = useRef(reminders);
  const todosRef = useRef(todos);
  actionItemsRef.current = actionItems;
  remindersRef.current = reminders;
  todosRef.current = todos;

  // Track which items have been alerted so we don't spam
  const alertedIds = useRef<Set<string>>(new Set());
  // Polling interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Returns current local time as "HH:MM" for time-of-day comparison. */
  function currentLocalHHMM(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  /** Returns true if the scheduled time (HH:MM) has been reached or passed. */
  function isTimeReached(scheduledTime: string | undefined | null, nowHHMM: string): boolean {
    if (!scheduledTime) return true; // no time set — fire on date match
    return scheduledTime <= nowHHMM;
  }

  /** Normalizes a date value to "YYYY-MM-DD", handling both ISO strings and PostgreSQL timestamps. */
  function formatDateOnly(raw: string): string {
    return raw.split("T")[0].split(" ")[0];
  }

  useEffect(() => {
    async function checkAndAlert() {
      try {
        if (!currentUserId) return;

        const [engineVal, urlVal, tokenVal, careEnabled] = await Promise.all([
          getUserSetting(currentUserId, "notificationEngine"),
          getUserSetting(currentUserId, "notificationUrl"),
          getUserSetting(currentUserId, "notificationToken"),
          getUserSetting(currentUserId, "useCareAlerts"),
        ]);

        if (!careEnabled || careEnabled !== "true") return;
        if (!engineVal || engineVal === "disabled") return;
        if (!urlVal) return;

        const config: NotificationConfig = {
          engine: engineVal as NotificationEngine,
          url: urlVal,
          token: tokenVal ?? "",
          useWeatherAlerts: false,
          useCareAlerts: true,
        };

        const today = new Date().toISOString().split("T")[0];
        const nowHHMM = currentLocalHHMM();
        const { sendNotification } = await import("@/lib/notification-engine");

        // Read latest values from refs
        const items = actionItemsRef.current;
        const rms = remindersRef.current;
        const tds = todosRef.current;

        // Check due (not completed) action items
        for (const item of items) {
          if (item.completed) continue;
          if (item.date > today) continue;
          if (!isTimeReached(item.time, nowHHMM)) continue;
          if (alertedIds.current.has(item.id)) continue;

          alertedIds.current.add(item.id);
          const plantInfo = item.plantNames.length > 0
            ? ` for ${item.plantNames.join(", ")}`
            : "";

          await sendNotification(config, {
            title: `Care Task Due: ${item.title}`,
            body: `Task "${item.title}"${plantInfo} is due today (${formatDateOnly(item.date)}${item.time ? ` at ${item.time}` : ""}).${item.note ? `\n\nNote: ${item.note}` : ""}`,
            priority: 7,
          });
        }

        // Check due reminders
        for (const reminder of rms) {
          if (reminder.completed) continue;
          if (reminder.date > today) continue;
          if (!isTimeReached(reminder.time, nowHHMM)) continue;
          if (alertedIds.current.has(reminder.id)) continue;

          alertedIds.current.add(reminder.id);
          const plantInfo = reminder.plantName
            ? ` for ${reminder.plantName}`
            : "";

          await sendNotification(config, {
            title: `Reminder: ${reminder.title}`,
            body: `Reminder "${reminder.title}"${plantInfo} is due today (${formatDateOnly(reminder.date)}${reminder.time ? ` at ${reminder.time}` : ""}).${reminder.note ? `\n\nNote: ${reminder.note}` : ""}`,
            priority: 6,
          });
        }

        // Check due todos
        for (const todo of tds) {
          if (todo.completed) continue;
          if (todo.date > today) continue;
          if (!isTimeReached(todo.time, nowHHMM)) continue;
          if (alertedIds.current.has(todo.id)) continue;

          alertedIds.current.add(todo.id);
          await sendNotification(config, {
            title: `Todo Due: ${todo.title}`,
            body: `Todo "${todo.title}" is due today (${formatDateOnly(todo.date)}${todo.time ? ` at ${todo.time}` : ""}).${todo.description ? `\n\n${todo.description}` : ""}`,
            priority: 5,
          });
        }
      } catch {
        // Silently fail — notifications are best-effort
      }
    }

    // Run immediately on mount
    checkAndAlert();

    // Then poll every 60 seconds
    intervalRef.current = setInterval(checkAndAlert, 60_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentUserId]);
}
