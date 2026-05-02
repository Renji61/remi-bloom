"use client";

import { Cloud, MapPin } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";

/**
 * Weather settings shown in Settings > Weather.
 * The city location picker has moved to the /weather page.
 */
export function WeatherConfig() {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
            <Cloud size={22} className="text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              Weather Location
            </h2>
            <p className="text-xs text-on-surface-variant/70">
              Set your city on the Weather page for alerts and forecasts
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container/50 px-4 py-3">
          <p className="text-xs text-on-surface-variant/70 leading-relaxed">
            The city location picker has moved to the{" "}
            <span className="font-semibold text-on-surface">Weather</span> page.
            Set your API key in{" "}
            <span className="font-semibold text-on-surface">Settings &gt; API Keys</span>,
            then choose your city directly when viewing the weather forecast.
          </p>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => window.location.href = "/weather"}
        >
          <MapPin size={14} />
          Go to Weather Page
        </Button>
      </CardContent>
    </Card>
  );
}
