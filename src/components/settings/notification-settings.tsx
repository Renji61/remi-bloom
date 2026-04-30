"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Server, Key, Check, Loader2, Info, ExternalLink, Thermometer, CloudRain } from "lucide-react";
import {
  Card,
  CardContent,
  Input,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { getUserSetting, setUserSetting } from "@/lib/db";
import { useAppStore } from "@/stores/app-store";
import type { NotificationEngine } from "@/lib/notification-engine";
import type { User } from "@/lib/db";

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch("/api/profile", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
}

const ENGINE_OPTIONS: { value: NotificationEngine; label: string }[] = [
  { value: "disabled", label: "Disabled" },
  { value: "gotify", label: "Gotify" },
  { value: "apprise", label: "Apprise API" },
];

export function NotificationSettings() {
  const storeEngine = useAppStore((s) => s.notificationEngineType);
  const storeUrl = useAppStore((s) => s.notificationEngineUrl);
  const storeToken = useAppStore((s) => s.notificationEngineToken);
  const storeWeather = useAppStore((s) => s.useWeatherAlerts);
  const storeCare = useAppStore((s) => s.useCareAlerts);
  const setEngine = useAppStore((s) => s.setNotificationEngine);
  const setUrl = useAppStore((s) => s.setNotificationEngineUrl);
  const setToken = useAppStore((s) => s.setNotificationEngineToken);
  const setWeather = useAppStore((s) => s.setUseWeatherAlerts);
  const setCare = useAppStore((s) => s.setUseCareAlerts);
  const currentUserId = useAppStore((s) => s.currentUserId);

  const [engine, setLocalEngine] = useState<NotificationEngine>("disabled");
  const [url, setLocalUrl] = useState("");
  const [token, setLocalToken] = useState("");
  const [weatherAlerts, setLocalWeather] = useState(false);
  const [careAlerts, setLocalCare] = useState(false);
  const [tempAboveEnabled, setLocalTempAbove] = useState(false);
  const [tempAboveValue, setLocalTempAboveValue] = useState("");
  const [tempBelowEnabled, setLocalTempBelow] = useState(false);
  const [tempBelowValue, setLocalTempBelowValue] = useState("");
  const [rainEnabled, setLocalRain] = useState(false);
  const [rainWindowHours, setLocalRainWindow] = useState("24");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      let userId = currentUserId;

      // Try to restore session if we don't have a userId yet
      if (!userId) {
        const session = await fetchCurrentUser();
        if (session) {
          const store = useAppStore.getState();
          store.setCurrentUser(session);
          userId = session.id;
        }
      }

      if (!userId) {
        setLoaded(true);
        return;
      }

      const [engineVal, urlVal, tokenVal, weatherVal, careVal] = await Promise.all([
        getUserSetting(userId, "notificationEngine"),
        getUserSetting(userId, "notificationUrl"),
        getUserSetting(userId, "notificationToken"),
        getUserSetting(userId, "useWeatherAlerts"),
        getUserSetting(userId, "useCareAlerts"),
      ]);

      const e = (engineVal as NotificationEngine) || "disabled";
      setLocalEngine(e);
      setLocalUrl(urlVal ?? "");
      setLocalToken(tokenVal ?? "");
      setLocalWeather(weatherVal === "true");
      setLocalCare(careVal === "true");

      // Load forecast alert rule settings
      const [
        tempAboveE, tempAboveV, tempBelowE, tempBelowV,
        rainE, rainW,
      ] = await Promise.all([
        getUserSetting(userId, "weatherAlertTempAboveEnabled"),
        getUserSetting(userId, "weatherAlertTempAboveValue"),
        getUserSetting(userId, "weatherAlertTempBelowEnabled"),
        getUserSetting(userId, "weatherAlertTempBelowValue"),
        getUserSetting(userId, "weatherAlertRainEnabled"),
        getUserSetting(userId, "weatherAlertRainWindowHours"),
      ]);
      setLocalTempAbove(tempAboveE === "true");
      setLocalTempAboveValue(tempAboveV ?? "");
      setLocalTempBelow(tempBelowE === "true");
      setLocalTempBelowValue(tempBelowV ?? "");
      setLocalRain(rainE === "true");
      setLocalRainWindow(rainW ?? "24");

      setLoaded(true);
    }
    load();
  }, [currentUserId]);

  const handleSave = async () => {
    if (!currentUserId) return;
    setSaving(true);
    setTestResult(null);

    await Promise.all([
      setUserSetting(currentUserId, "notificationEngine", engine),
      setUserSetting(currentUserId, "notificationUrl", url.trim()),
      setUserSetting(currentUserId, "notificationToken", token.trim()),
      setUserSetting(currentUserId, "useWeatherAlerts", String(weatherAlerts)),
      setUserSetting(currentUserId, "useCareAlerts", String(careAlerts)),
      setUserSetting(currentUserId, "weatherAlertTempAboveEnabled", String(tempAboveEnabled)),
      setUserSetting(currentUserId, "weatherAlertTempAboveValue", String(tempAboveValue)),
      setUserSetting(currentUserId, "weatherAlertTempBelowEnabled", String(tempBelowEnabled)),
      setUserSetting(currentUserId, "weatherAlertTempBelowValue", String(tempBelowValue)),
      setUserSetting(currentUserId, "weatherAlertRainEnabled", String(rainEnabled)),
      setUserSetting(currentUserId, "weatherAlertRainWindowHours", String(rainWindowHours)),
    ]);

    // Sync to zustand store
    setEngine(engine);
    setUrl(url.trim());
    setToken(token.trim());
    setWeather(weatherAlerts);
    setCare(careAlerts);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestResult(null);

    if (!url.trim() || engine === "disabled") {
      setTestResult({ type: "error", message: "Select an engine and enter a URL first." });
      return;
    }

    try {
      const { sendNotification } = await import("@/lib/notification-engine");

      const result = await sendNotification(
        {
          engine,
          url: url.trim(),
          token: token.trim(),
          useWeatherAlerts: weatherAlerts,
          useCareAlerts: careAlerts,
        },
        {
          title: "🔔 REMI Bloom — Test Notification",
          body: "This is a test alert from your REMI Bloom dashboard. If you see this, your notification engine is configured correctly!",
          priority: 8,
        }
      );

      if (result.success) {
        setTestResult({ type: "success", message: "Test notification sent successfully!" });
      } else {
        setTestResult({ type: "error", message: result.error ?? "Failed to send test notification." });
      }
    } catch (err) {
      setTestResult({
        type: "error",
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    }
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10">
            <Bell size={22} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              External Notifications
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              Send weather alerts and care reminders to Gotify or Apprise
            </p>
          </div>
        </div>

        {/* Engine Select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
            Notification Engine
          </label>
          <Select
            value={engine}
            onValueChange={(v) => setLocalEngine(v as NotificationEngine)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select notification engine..." />
            </SelectTrigger>
            <SelectContent>
              {ENGINE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {engine !== "disabled" && (
          <>
            {/* Engine-specific help text */}
            {engine === "gotify" && (
              <div className="flex items-start gap-2 rounded-xl bg-surface-container/50 px-3 py-2.5">
                <Info size={14} className="mt-0.5 shrink-0 text-on-surface-variant/60" />
                <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                  Enter your <strong className="text-on-surface">Gotify server URL</strong> (e.g.{" "}
                  <code className="text-[var(--theme-primary)]">https://gotify.example.com</code>)
                  and your <strong className="text-on-surface">app token</strong>. The app token
                  can be found in the Gotify web UI under "Apps" &gt; "Create Application".
                </p>
              </div>
            )}

            {engine === "apprise" && (
              <div className="flex items-start gap-2 rounded-xl bg-surface-container/50 px-3 py-2.5">
                <Info size={14} className="mt-0.5 shrink-0 text-on-surface-variant/60" />
                <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                  Enter your <strong className="text-on-surface">Apprise API URL</strong> (e.g.{" "}
                  <code className="text-[var(--theme-primary)]">http://apprise:8000</code>).
                  If your Apprise API requires a token/API key, enter it in the Token field.
                  Configure your notification services (Gotify, Telegram, Email, etc.) inside
                  the Apprise container via its configuration.
                </p>
              </div>
            )}

            {/* URL Field */}
            <Input
              label={engine === "gotify" ? "Gotify Server URL" : "Apprise API URL"}
              value={url}
              onChange={(e) => setLocalUrl(e.target.value)}
              placeholder={
                engine === "gotify"
                  ? "https://gotify.example.com"
                  : "http://apprise:8000"
              }
            />

            {/* Token Field */}
            <Input
              label={engine === "gotify" ? "Gotify App Token" : "API Key (optional)"}
              type="password"
              value={token}
              onChange={(e) => setLocalToken(e.target.value)}
              placeholder={
                engine === "gotify"
                  ? "Enter your Gotify app token..."
                  : "Enter Apprise API key (if required)..."
              }
            />

            {/* Alert Toggles */}
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
                Alert Triggers
              </p>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={weatherAlerts}
                  onChange={(e) => setLocalWeather(e.target.checked)}
                  className="h-4 w-4 rounded border-outline/30 bg-surface-container/60 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]/30"
                />
                <div>
                  <span className="text-sm text-on-surface">Weather Alerts</span>
                  <p className="text-xs text-on-surface-variant/60">
                    Send notifications for extreme weather (frost, heatwave, storms)
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={careAlerts}
                  onChange={(e) => setLocalCare(e.target.checked)}
                  className="h-4 w-4 rounded border-outline/30 bg-surface-container/60 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]/30"
                />
                <div>
                  <span className="text-sm text-on-surface">Care Reminders</span>
                  <p className="text-xs text-on-surface-variant/60">
                    Send notifications when care tasks and reminders are due
                  </p>
                </div>
              </label>
            </div>

            {/* Forecast Alert Rules */}
            {weatherAlerts && (
              <div className="space-y-3 pt-1 border-t border-outline-variant/30">
                <div className="flex items-center gap-2 pt-1">
                  <Thermometer size={14} className="text-[var(--theme-primary)]/60" />
                  <p className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
                    Forecast Alert Rules
                  </p>
                </div>

                {/* Temperature Above */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempAboveEnabled}
                    onChange={(e) => setLocalTempAbove(e.target.checked)}
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
                      onChange={(e) => setLocalTempAboveValue(e.target.value)}
                      placeholder="e.g. 35"
                    />
                  </div>
                )}

                {/* Temperature Below */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempBelowEnabled}
                    onChange={(e) => setLocalTempBelow(e.target.checked)}
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
                      onChange={(e) => setLocalTempBelowValue(e.target.value)}
                      placeholder="e.g. 0"
                    />
                  </div>
                )}

                {/* Rain Alert */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rainEnabled}
                    onChange={(e) => setLocalRain(e.target.checked)}
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
                      onChange={(e) => setLocalRainWindow(e.target.value)}
                      placeholder="24"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Test Button */}
            <Button
              onClick={handleTest}
              variant="secondary"
              disabled={!url.trim()}
              className="w-full"
            >
              <Bell size={14} />
              Send Test Notification
            </Button>

            {testResult && (
              <div
                className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
                  testResult.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {testResult.type === "success" ? (
                  <Check size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={14} className="mt-0.5 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </>
        )}

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : (
            <Server size={14} />
          )}
          {saved ? "Saved!" : "Save Notification Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
