"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import nextDynamic from "next/dynamic";

const GardenCanvas = nextDynamic(
  () => import("@/components/planner/garden-canvas"),
  { ssr: false }
);

export default function PlannerPage() {
  usePageTitle("Garden Planner");
  return (
    <div className="flex h-full flex-col space-y-3">
      <div>
        <p className="text-xs text-on-surface-variant/70">
          Design your garden with square-foot precision
        </p>
      </div>
      <div className="flex-1 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container/30">
        <GardenCanvas />
      </div>
    </div>
  );
}
