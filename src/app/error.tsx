"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  usePageTitle("Error");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 mb-6">
        <AlertTriangle size={32} className="text-red-400" />
      </div>
      <h1 className="text-2xl font-bold text-on-surface">Something went wrong</h1>
      <p className="mt-2 text-sm text-on-surface-variant/70 max-w-xs">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset} className="mt-6">
        <RefreshCw size={14} />
        Try Again
      </Button>
    </div>
  );
}
