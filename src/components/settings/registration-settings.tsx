"use client";

import { useState, useEffect } from "react";
import { ShieldX, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useAppStore } from "@/stores/app-store";

export function RegistrationSettings() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentUser = useAppStore((s) => s.currentUser);

  const [open, setOpen] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch("/api/registration-status")
      .then((r) => r.json())
      .then((data) => setOpen(data.open))
      .catch(() => setOpen(false))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    if (!currentUserId || open === null) return;
    setToggling(true);
    try {
      const response = await fetch("/api/registration-status", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: !open }),
      });
      if (response.ok) {
        setOpen(!open);
      }
    } catch {
      // Silently fail
    } finally {
      setToggling(false);
    }
  };

  const isAdmin = currentUser?.role === "admin";

  if (!loading && !isAdmin) return null;

  return (
    <div className="rounded-xl border border-outline/10 bg-surface-container/20 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            open === false ? "bg-yellow-500/10" : "bg-green-500/10"
          }`}
        >
          {open === false ? (
            <ShieldX size={18} className="text-yellow-500" />
          ) : (
            <ShieldCheck size={18} className="text-green-500" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Open Registration</h3>
          <p className="text-[10px] text-on-surface-variant/60">
            {open === false
              ? "New users cannot create accounts"
              : "Anyone can create an account"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 size={16} className="animate-spin text-on-surface-variant" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-on-surface-variant/70">
            {open === false
              ? "Public registration is disabled"
              : "Public registration is enabled"}
          </span>
          <Button
            onClick={handleToggle}
            disabled={toggling || !isAdmin}
            size="sm"
            variant={open === false ? "primary" : "secondary"}
          >
            {toggling ? (
              <Loader2 size={14} className="animate-spin" />
            ) : open === false ? (
              "Enable"
            ) : (
              "Disable"
            )}
          </Button>
        </div>
      )}

      {!isAdmin && !loading && (
        <p className="text-[10px] text-on-surface-variant/40 text-center">
          Only administrators can change this setting.
        </p>
      )}
    </div>
  );
}
