"use client";

import { useRef, useCallback } from "react";

interface GestureHandlers {
  onLongPress?: () => void;
  onTap?: () => void;
  duration?: number;
}

export function useLongPress({
  onLongPress,
  onTap,
  duration = 500,
}: GestureHandlers) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback(() => {
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      onLongPress?.();
    }, duration);
  }, [onLongPress, duration]);

  const end = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPress.current) {
      onTap?.();
    }
  }, [onTap]);

  return {
    onTouchStart: start,
    onTouchEnd: end,
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: end,
  };
}
