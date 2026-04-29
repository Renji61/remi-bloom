"use client";

import { useState, useEffect } from "react";

/**
 * Debounce a value by the specified delay in milliseconds.
 * Returns the debounced value that updates only after the delay
 * has elapsed since the last change.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
