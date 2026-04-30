"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, MonitorSmartphone, Sparkles, Share2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui";

const DISMISSED_KEY = "remi-bloom-pwa-dismissed";

/**
 * PWA Install Prompt component.
 *
 * Shows a banner at the top of the home page on mobile browsers.
 * On supported browsers (Chrome Android) it triggers the native install prompt.
 * On others (iOS Safari, etc.) it shows manual install instructions.
 * The user can dismiss it for the current session.
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed === "true") {
      setDismissedThisSession(true);
      return;
    }

    // Check if already installed (display-mode: standalone)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setInstalled(true);
      return;
    }

    // Only show on mobile screens
    if (window.innerWidth >= 768) {
      return;
    }
    setIsMobile(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also handle the case where the app was just installed
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShow(false);
    });

    // If after a short delay no beforeinstallprompt event fired,
    // show the manual install guide anyway (covers iOS and other browsers)
    const timeout = setTimeout(() => {
      if (!deferredPrompt) {
        setShow(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timeout);
    };
  }, [deferredPrompt]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;

    if (result.outcome === "accepted") {
      setInstalled(true);
      setShow(false);
    }

    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    sessionStorage.setItem(DISMISSED_KEY, "true");
    setDismissedThisSession(true);
  }, []);

  // Don't show if already installed or dismissed this session
  if (installed || dismissedThisSession || !show || !isMobile) {
    return null;
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="relative rounded-2xl border border-[var(--theme-primary)]/15 bg-gradient-to-br from-[var(--theme-primary)]/8 via-surface-container-high/50 to-[var(--theme-primary)]/5 p-4">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute right-2.5 top-2.5 rounded-lg p-1 text-on-surface-variant/50 hover:bg-surface-container-higher hover:text-on-surface-variant transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>

            <div className="flex items-start gap-3 pr-6">
              {/* Icon */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/15">
                <MonitorSmartphone size={20} className="text-[var(--theme-primary)]" />
              </div>

              <div className="min-w-0 flex-1">
                {deferredPrompt ? (
                  <>
                    <h3 className="text-sm font-semibold text-on-surface">
                      Install REMI Bloom
                    </h3>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant/70 leading-relaxed">
                      Add to your home screen for a faster, offline-ready experience with
                      quick access to your garden.
                    </p>

                    {/* Feature badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--theme-primary)]">
                        <Sparkles size={10} />
                        Works offline
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--theme-primary)]">
                        <Download size={10} />
                        Instant loading
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--theme-primary)]">
                        <Share2 size={10} />
                        App-like UI
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleInstall}
                        className="flex-1"
                      >
                        <Download size={13} />
                        Install App
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDismiss}
                        className="flex-shrink-0"
                      >
                        Not now
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-on-surface">
                      Add to Home Screen
                    </h3>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant/70 leading-relaxed">
                      Install REMI Bloom on your device for the best experience:
                    </p>

                    <ol className="mt-2.5 space-y-1.5 text-[11px] text-on-surface-variant/80">
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary)]/15 text-[8px] font-bold text-[var(--theme-primary)]">1</span>
                        Tap the <strong className="text-on-surface">Share</strong> button in your browser
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary)]/15 text-[8px] font-bold text-[var(--theme-primary)]">2</span>
                        Scroll down and tap <strong className="text-on-surface">Add to Home Screen</strong>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary)]/15 text-[8px] font-bold text-[var(--theme-primary)]">3</span>
                        Tap <strong className="text-on-surface">Add</strong> in the top-right corner
                      </li>
                    </ol>

                    {/* Feature badges */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--theme-primary)]">
                        <Sparkles size={10} />
                        Works offline
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--theme-primary)]">
                        <Download size={10} />
                        Instant loading
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--theme-primary)]">
                        <Smartphone size={10} />
                        App-like UI
                      </span>
                    </div>

                    {/* Dismiss button */}
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDismiss}
                      >
                        Got it
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
