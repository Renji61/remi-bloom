"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { Settings, Info, Cloud, DollarSign, Key } from "lucide-react";
import { Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { ThemePicker } from "@/components/settings/theme-picker";
import { FaviconSettings } from "@/components/settings/favicon-settings";
import { CurrencySettings } from "@/components/settings/currency-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { WeatherConfig } from "@/components/settings/weather-config";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { ApiKeySettings } from "@/components/settings/api-key-settings";

export default function SettingsPage() {
  usePageTitle("Settings");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            Customize your experience
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-high">
          <Settings size={18} className="text-on-surface-variant" />
        </div>
      </div>

      <Tabs defaultValue="appearance">
        <TabsList className="w-full overflow-x-auto flex-nowrap sm:flex-wrap sm:flex-row hide-scrollbar gap-1">
          <TabsTrigger value="appearance" className="shrink-0 sm:flex-1">Appearance</TabsTrigger>
          <TabsTrigger value="notifications" className="shrink-0 sm:flex-1">Notifications</TabsTrigger>
          <TabsTrigger value="apikeys" className="shrink-0 sm:flex-1">API Keys</TabsTrigger>
          <TabsTrigger value="currency" className="shrink-0 sm:flex-1">Currency</TabsTrigger>
          <TabsTrigger value="weather" className="shrink-0 sm:flex-1">Weather</TabsTrigger>
          <TabsTrigger value="data" className="shrink-0 sm:flex-1">Data</TabsTrigger>
          <TabsTrigger value="about" className="shrink-0 sm:flex-1">About</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <ThemePicker />
          <div className="mt-4">
            <FaviconSettings />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="apikeys">
          <ApiKeySettings />
        </TabsContent>

        <TabsContent value="currency">
          <CurrencySettings />
        </TabsContent>

        <TabsContent value="weather">
          <WeatherConfig />
        </TabsContent>

        <TabsContent value="data">
          <DataSettings />
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/10">
                  <Info size={22} className="text-[var(--theme-primary)]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-on-surface">
                    REMI Bloom
                  </h2>
                  <p className="text-xs text-on-surface-variant/70">
                    Version 1.0.0
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-outline-variant/40 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant/70">Framework</span>
                  <span className="text-xs text-on-surface-variant">Next.js 15</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant/70">Database</span>
                  <span className="text-xs text-on-surface-variant">Dexie (IndexedDB)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant/70">PWA</span>
                  <span className="text-xs text-on-surface-variant">serwist</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant/70">Design</span>
                  <span className="text-xs text-on-surface-variant">VerdantOS</span>
                </div>
              </div>
              <p className="mt-4 text-[10px] text-on-surface-variant/40 text-center">
                Built for plant enthusiasts. Open source.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
