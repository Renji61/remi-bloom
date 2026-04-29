"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  usePageTitle("Page Not Found");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/20 mb-6">
        <Sprout size={32} className="text-[var(--theme-primary)]" />
      </div>
      <h1 className="text-4xl font-bold text-on-surface">404</h1>
      <p className="mt-2 text-sm text-on-surface-variant/70 max-w-xs">
        This page doesn&apos;t exist. It may have been moved or deleted.
      </p>
      <Link href="/home" className="mt-6">
        <Button>
          <Sprout size={14} />
          Go Home
        </Button>
      </Link>
    </div>
  );
}
