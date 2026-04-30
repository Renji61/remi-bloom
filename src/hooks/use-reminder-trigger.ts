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

  // Track which items have been alerted so we don't spam
  const alertedIds = useRef<Set<string>>(new Set());
  // Polling interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        const { sendNotification } = await import("@/lib/notification-engine");

        // Check due (not completed) action items
        for (const item of actionItems) {
          if (item.completed) continue;
          if (item.date > today) continue;
          if (alertedIds.current.has(item.id)) continue;

          alertedIds.current.add(item.id);
          const plantInfo = item.plantNames.length > 0
            ? ` for ${item.plantNames.join(", ")}`
            : "";

          await sendNotification(config, {
            title: `🌱 Care Task Due: ${item.title}`,
            body: `Task "${item.title}"${plantInfo} is due today (${item.date}${item.time ? ` at ${item.time}` : ""}).${item.note ? `\n\nNote: ${item.note}` : ""}`,
            priority: 7,
          });
        }

        // Check due reminders
        for (const reminder of reminders) {
          if (reminder.completed) continue;
          if (reminder.date > today) continue;
          if (alertedIds.current.has(reminder.id)) continue;

          alertedIds.current.add(reminder.id);
          const plantInfo = reminder.plantName
            ? ` for ${reminder.plantName}`
            : "";

          await sendNotification(config, {
            title: `⏰ Reminder: ${reminder.title}`,
            body: `Reminder "${reminder.title}"${plantInfo} is due today (${reminder.date}${reminder.time ? ` at ${reminder.time}` : ""}).${reminder.note ? `\n\nNote: ${reminder.note}` : ""}`,
            priority: 6,
          });
        }

        // Check due todos
        for (const todo of todos) {
          if (todo.completed) continue;
          if (todo.date > today) continue;
          if (alertedIds.current.has(todo.id)) continue;

          alertedIds.current.add(todo.id);
          await sendNotification(config, {
            title: `📋 Todo Due: ${todo.title}`,
            body: `Todo "${todo.title}" is due today (${todo.date}${todo.time ? ` at ${todo.time}` : ""}).${todo.description ? `\n\n${todo.description}` : ""}`,
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
  }, [actionItems, reminders, todos]);
}
