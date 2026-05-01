"use client";

import { useState, useEffect, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/db";

const ALLOWED_PROTOCOLS = ["https:", "blob:", "data:"];
const ALLOWED_PREFIXES = ["/icons/", "/images/", "/_next/"];

function isSafeImageUrl(src: string): boolean {
  try {
    // Allow relative paths from the app's own static directory
    if (src.startsWith("/")) {
      return ALLOWED_PREFIXES.some((prefix) => src.startsWith(prefix));
    }
    // upload: prefix is handled by the caller — resolve to blob URL first
    if (src.startsWith("upload:")) return false;
    // Validate absolute URLs
    const parsed = new URL(src);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

export function SafeImage({ src, alt, className, fallback, onError, ...props }: SafeImageProps) {
  const [loadError, setLoadError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string>("");

  // Resolve upload: references to blob URLs
  useEffect(() => {
    if (typeof src !== "string" || !src) {
      setResolvedSrc("");
      return;
    }
    if (src.startsWith("upload:")) {
      const imageId = src.slice("upload:".length);
      getImageUrl(imageId).then((blobUrl) => {
        if (blobUrl) setResolvedSrc(blobUrl);
        else setLoadError(true);
      });
      return;
    }
    setResolvedSrc(src);
  }, [src]);

  const safeSrc = resolvedSrc;

  if (!safeSrc || !isSafeImageUrl(safeSrc) || loadError) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div
        className={cn("flex items-center justify-center bg-surface-container-high/40 text-on-surface-variant/40", className)}
        aria-hidden="true"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      className={cn("object-cover", className)}
      onError={(e) => {
        setLoadError(true);
        onError?.(e);
      }}
      {...props}
    />
  );
}
