"use client";

import { Card, CardContent, Button } from "@/components/ui";
import { RefreshCw, Download } from "lucide-react";
import { db } from "@/lib/db";

export function SensorConfig() {
  const handleExport = async () => {
    const plants = await db.plants.toArray();
    const events = await db.careEvents.toArray();
    const locations = await db.plantLocations.toArray();

    const data = {
      exportDate: new Date().toISOString(),
      plantCount: plants.length,
      careEventCount: events.length,
      locationCount: locations.length,
      plants,
      careEvents: events,
      locations,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remi-bloom-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-on-surface">
                Data Management
              </span>
              <p className="mt-0.5 text-xs text-on-surface-variant/70">
                All data is stored locally in your browser
              </p>
            </div>
            <div className="flex h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant/70">
          Actions
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={handleExport}
        >
          <Download size={16} />
          Export All Data (JSON)
        </Button>
      </div>
    </div>
  );
}
