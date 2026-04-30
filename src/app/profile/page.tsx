"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, Save, Loader2, Check, Key, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { signOut } from "next-auth/react";
import { formatDate } from "@/lib/utils";
import type { User as AppUser } from "@/lib/db";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error ?? "Request failed");
  }
  return response.json();
}

export default function ProfilePage() {
  usePageTitle("Profile");
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      const user = currentUser ?? await apiFetch<AppUser>("/api/profile").catch(() => null);
      if (!user) {
        router.replace("/login");
        return;
      }
      setCurrentUser(user);
      setUsername(user.username);
      setDisplayName(user.displayName);
      setEmail(user.email);
      setLoaded(true);
    }
    init();
  }, [currentUser, setCurrentUser, router]);

  // Debounced username uniqueness check
  const checkUsernameAvailability = (value: string) => {
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    if (!value.trim() || value.trim() === currentUser?.username) {
      setUsernameError(null);
      return;
    }
    usernameCheckTimer.current = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/profile/check-username?username=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (!data.available) {
          setUsernameError(`Username "@${value.trim()}" is already taken. Please choose another one.`);
        } else {
          setUsernameError(null);
        }
      } catch {
        // Silently fail – the save handler will catch duplicates
        setUsernameError(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setSaving(true);
    setProfileError(null);

    try {
      const updated = await apiFetch<AppUser>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          email: email.trim(),
        }),
      });
      setCurrentUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error: any) {
      if (error.message?.includes("already exists") || error.message?.includes("already taken")) {
        setUsernameError("This username is already taken. Please choose another one.");
      } else {
        setProfileError(error.message ?? "Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);

    if (!currentPassword) {
      setPwError("Current password is required");
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setPwError("Password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match");
      return;
    }
    if (!currentUser) return;

    setPwSaving(true);
    try {
      await apiFetch<AppUser>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (error: any) {
      setPwError(error.message ?? "An unexpected error occurred");
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    setCurrentUser(null);
    router.push("/login");
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-on-surface-variant/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant/70">
            Manage your account
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-high">
          <User size={18} className="text-on-surface-variant" />
        </div>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/20">
              <span className="text-2xl font-bold text-[var(--theme-primary)]">
                {currentUser?.displayName?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-on-surface">
                {currentUser?.displayName || "Unknown"}
              </h2>
              <p className="text-xs text-on-surface-variant/70">
                @{currentUser?.username || "unknown"}
              </p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                currentUser?.role === "admin"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}>
                {currentUser?.role || "user"}
              </span>
            </div>
          </div>

          {currentUser?.lastLoginAt && (
            <div className="rounded-xl bg-surface-container/50 px-3 py-2">
              <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-wider">
                Last Login
              </p>
              <p className="text-xs text-on-surface-variant">
                {formatDate(new Date(currentUser.lastLoginAt))}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
              <User size={18} className="text-sky-400" />
            </div>
            <h2 className="text-sm font-semibold text-on-surface">Edit Profile</h2>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant/60 font-semibold">
                @
              </span>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setProfileError(null);
                  checkUsernameAvailability(e.target.value);
                }}
                placeholder="username"
                autoComplete="username"
                className={`w-full rounded-2xl border pl-8 pr-4 py-3 text-sm text-on-surface bg-surface-container/60 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
                  usernameError
                    ? "border-red-400/50 focus:border-red-400/50 focus:ring-red-400/20"
                    : "border-outline/30 focus:border-[var(--theme-primary)]/50 focus:ring-[var(--theme-primary)]/20"
                }`}
              />
            </div>
            {checkingUsername && (
              <p className="mt-1 text-[11px] text-on-surface-variant/50">Checking availability...</p>
            )}
            {usernameError && (
              <p className="mt-1 text-[11px] text-red-400">{usernameError}</p>
            )}
          </div>

          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
          />

          {profileError && (
            <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {profileError}
            </div>
          )}

          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} />
            ) : (
              <Save size={14} />
            )}
            {saved ? "Saved!" : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Key size={18} className="text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-on-surface">Change Password</h2>
          </div>

          <div className="relative">
            <Input
              label="Current Password"
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-[38px] text-on-surface-variant/50 hover:text-on-surface-variant"
              tabIndex={-1}
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="New Password"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-[38px] text-on-surface-variant/50 hover:text-on-surface-variant"
              tabIndex={-1}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-[38px] text-on-surface-variant/50 hover:text-on-surface-variant"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {pwError && (
            <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {pwError}
            </div>
          )}

          {pwSuccess && (
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              Password changed successfully!
            </div>
          )}

          <Button
            onClick={handleChangePassword}
            disabled={pwSaving}
            variant="secondary"
            className="w-full"
          >
            {pwSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : pwSuccess ? (
              <Check size={14} />
            ) : (
              <Key size={14} />
            )}
            {pwSaving ? "Changing..." : pwSuccess ? "Changed!" : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button onClick={handleLogout} variant="secondary" className="w-full">
        <LogOut size={14} />
        Sign Out
      </Button>
    </div>
  );
}
