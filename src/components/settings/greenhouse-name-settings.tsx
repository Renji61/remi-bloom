"use client";

import { useState, useEffect } from "react";
import { Sprout, Check, Loader2 } from "lucide-react";
import { Input, Button } from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { getUserSetting, setUserSetting } from "@/lib/db";

const SETTING_KEY = "greenhouseName";

export function GreenhouseNameSettings() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const greenhouseName = useAppStore((s) => s.greenhouseName);
  const setGreenhouseName = useAppStore((s) => s.setGreenhouseName);

  const [name, setName] = useState(greenhouseName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved name
  useEffect(() => {
    async function load() {
      if (!currentUserId) {
        setLoaded(true);
        return;
      }
      const saved = await getUserSetting(currentUserId, SETTING_KEY);
      if (saved) {
        setName(saved);
        setGreenhouseName(saved);
      }
      setLoaded(true);
    }
    load();
  }, [currentUserId, setGreenhouseName]);

  const handleSave = async () => {
    if (!currentUserId || !name.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await setUserSetting(currentUserId, SETTING_KEY, name.trim());
      setGreenhouseName(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-outline/10 bg-surface-container/20 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-primary)]/10">
          <Sprout size={18} className="text-[var(--theme-primary)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Greenhouse Name</h3>
          <p className="text-[10px] text-on-surface-variant/60">
            Rename your greenhouse displayed on the homepage
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="My Greenhouse"
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim()} size="sm" className="shrink-0 self-end">
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
