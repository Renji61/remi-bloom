"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import nextDynamic from "next/dynamic";
import { Leaf } from "lucide-react";

const PlantIdentifier = nextDynamic(
  () => import("@/components/lab/plant-identifier").then((m) => m.PlantIdentifier),
  { ssr: false }
);

export default function IdentifyPage() {
  usePageTitle("Identify Plants");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            AI-powered plant identification & health analysis
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--theme-primary)]/10">
          <Leaf size={18} className="text-[var(--theme-primary)]" />
        </div>
      </div>
      <PlantIdentifier />
    </div>
  );
}
