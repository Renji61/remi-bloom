"use client";

import { useEffect } from "react";

/**
 * Set the browser document title for a page.
 * Works with the template from layout.tsx ("%s — REMI Bloom").
 * Falls back to just setting the title directly if no template match is needed.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — REMI Bloom`;
  }, [title]);
}
