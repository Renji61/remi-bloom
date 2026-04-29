"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { Sprout, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export default function OfflinePage() {
  usePageTitle("Offline");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface p-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-primary-container)]">
        <Sprout size={32} className="text-[var(--theme-onPrimary)]" />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-on-surface">
        You&#39;re Offline
      </h1>
      <p className="mb-6 max-w-xs text-sm text-on-surface-variant">
        REMI Bloom needs a network connection to load new content. Your
        locally saved data is still available.
      </p>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw size={14} />
        Try Again
      </Button>
    </div>
  );
}
