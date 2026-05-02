"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Trash2,
  Key,
  Loader2,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  AlertTriangle,
  MoreVertical,
  LogOut,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, useConfirm } from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { type User, type UserRole, type AuditLog } from "@/lib/db";
import { formatDate } from "@/lib/utils";

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

export default function AdminClient() {
  const { confirm } = useConfirm();
  usePageTitle("Admin Dashboard");
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setStoreUsers = useAppStore((s) => s.setUsers);

  const [usersList, setUsersList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "logs">("users");

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [newEmail, setNewEmail] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Password reset dialogs
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const [users, logs] = await Promise.all([
      apiFetch<User[]>("/api/admin/users"),
      apiFetch<AuditLog[]>("/api/admin/audit-logs"),
    ]);
    setUsersList(users);
    setStoreUsers(users);
    setAuditLogs(logs);
  }, [setStoreUsers]);

  useEffect(() => {
    async function init() {
      const user = currentUser ?? await apiFetch<User>("/api/profile").catch(() => null);
      if (!user) {
        router.replace("/login");
        return;
      }
      setCurrentUser(user);
      if (user && user.role !== "admin") {
        router.replace("/home");
        return;
      }

      await loadData();
      setLoaded(true);
    }
    init();
  }, [currentUser, setCurrentUser, router, loadData]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCreateUser = async () => {
    setCreateError(null);

    if (!newUsername.trim() || !newPassword.trim() || !newDisplayName.trim()) {
      setCreateError("Username, display name, and password are required");
      return;
    }

    setSaving(true);
    try {
      const user = await apiFetch<User>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername.trim(),
          displayName: newDisplayName.trim(),
          password: newPassword,
          role: newRole,
          email: newEmail.trim(),
        }),
      });
      showMessage("success", `User "${user.username}" created successfully`);
      setShowCreate(false);
      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("");
      setNewRole("user");
      setNewEmail("");
      await loadData();
    } catch (error: any) {
      setCreateError(error.message ?? "Failed to create user");
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (!resetPassword || resetPassword.length < 3) {
      showMessage("error", "Password must be at least 3 characters");
      return;
    }
    if (resetPassword !== resetConfirm) {
      showMessage("error", "Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await apiFetch<User>(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPassword }),
      });
      showMessage("success", `Password reset for "${resetTarget.username}"`);
      setResetTarget(null);
      setResetPassword("");
      setResetConfirm("");
    } catch (error: any) {
      showMessage("error", error.message ?? "Failed to reset password");
    }
    setSaving(false);
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiFetch<User>(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      showMessage("success", `User "${user.username}" ${user.active ? "deactivated" : "activated"}`);
      await loadData();
    } catch (error: any) {
      showMessage("error", error.message ?? "Failed to toggle user status");
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!await confirm({ message: `Are you sure you want to permanently delete "${user.username}"? This cannot be undone.`, confirmLabel: "Delete", variant: "danger" })) {
      return;
    }

    try {
      await apiFetch<{ success: true }>(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      showMessage("success", `User "${user.username}" deleted`);
      await loadData();
    } catch (error: any) {
      showMessage("error", error.message ?? "Failed to delete user");
    }
  };

  const filteredUsers = usersList.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

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
            Manage users and view activity logs
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
          <Shield size={18} className="text-purple-400" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users size={18} className="mx-auto text-[var(--theme-primary)]" />
            <p className="mt-1 text-lg font-bold tabular-nums text-on-surface">{usersList.length}</p>
            <p className="text-[10px] text-on-surface-variant/60">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <UserCheck size={18} className="mx-auto text-emerald-400" />
            <p className="mt-1 text-lg font-bold tabular-nums text-on-surface">
              {usersList.filter((u) => u.active).length}
            </p>
            <p className="text-[10px] text-on-surface-variant/60">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Activity size={18} className="mx-auto text-purple-400" />
            <p className="mt-1 text-lg font-bold tabular-nums text-on-surface">{auditLogs.length}</p>
            <p className="text-[10px] text-on-surface-variant/60">Recent Events</p>
          </CardContent>
        </Card>
      </div>

      {/* Message banner */}
      {message && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
          message.type === "success"
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-red-500/10 text-red-400"
        }`}>
          {message.type === "success" ? (
            <CheckCircle size={14} />
          ) : (
            <AlertTriangle size={14} />
          )}
          {message.text}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("users")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "users"
              ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
              : "bg-surface-container/50 text-on-surface-variant/60 hover:text-on-surface-variant"
          }`}
        >
          <Users size={14} className="inline mr-1.5" />
          User Management
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
            activeTab === "logs"
              ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
              : "bg-surface-container/50 text-on-surface-variant/60 hover:text-on-surface-variant"
          }`}
        >
          <Activity size={14} className="inline mr-1.5" />
          Audit Logs
        </button>
      </div>

      {/* ──── User Management Tab ──── */}
      {activeTab === "users" && (
        <>
          {/* Search & Create */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
              />
            </div>
            <Button onClick={() => setShowCreate(!showCreate)} size="sm">
              <UserPlus size={14} />
              {showCreate ? "Cancel" : "Add User"}
            </Button>
          </div>

          {/* Create User Form */}
          {showCreate && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider">
                  Create New User
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Username"
                  />
                  <Input
                    label="Display Name"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Display name"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password"
                  />
                  <Input
                    label="Email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Email (optional)"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant">
                    Role
                  </label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {createError && (
                  <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {createError}
                  </div>
                )}

                <Button onClick={handleCreateUser} disabled={saving} className="w-full">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Create User
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Users list */}
          {filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Users size={24} className="mx-auto text-on-surface-variant/30" />
                <p className="mt-2 text-sm text-on-surface-variant/60">
                  {search ? "No users match your search" : "No users yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  currentUserId={currentUser?.id}
                  onResetPassword={() => setResetTarget(user)}
                  onToggleActive={() => handleToggleActive(user)}
                  onDelete={() => handleDeleteUser(user)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ──── Audit Logs Tab ──── */}
      {activeTab === "logs" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center">
                <Activity size={24} className="mx-auto text-on-surface-variant/30" />
                <p className="mt-2 text-sm text-on-surface-variant/60">No audit logs yet</p>
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl bg-surface-container/40 px-3 py-2.5"
                >
                  <div className="mt-0.5 shrink-0">
                    <Activity size={14} className="text-on-surface-variant/50" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-on-surface">
                        {log.username}
                      </span>
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-on-surface-variant/70">
                        {log.action}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant/50">
                      {log.details}
                    </p>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant/30">
                      {formatDate(new Date(log.timestamp))}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* ──── Reset Password Dialog ──── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <Key size={18} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">Reset Password</h3>
                  <p className="text-xs text-on-surface-variant/70">
                    for {resetTarget.displayName} (@{resetTarget.username})
                  </p>
                </div>
              </div>

              <Input
                label="New Password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter new password"
              />

              <Input
                label="Confirm Password"
                type="password"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="Confirm new password"
              />

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setResetTarget(null);
                    setResetPassword("");
                    setResetConfirm("");
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleResetPassword} disabled={saving} className="flex-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ──── User Row Component ────

function UserRow({
  user,
  currentUserId,
  onResetPassword,
  onToggleActive,
  onDelete,
}: {
  user: User;
  currentUserId?: string | null;
  onResetPassword: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const isSelf = user.id === currentUserId;
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Card className="overflow-visible">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            user.role === "admin"
              ? "bg-purple-500/20"
              : user.active
                ? "bg-[var(--theme-primary)]/20"
                : "bg-surface-container-high/50"
          }`}>
            <span className={`text-sm font-bold ${
              user.role === "admin"
                ? "text-purple-400"
                : user.active
                  ? "text-[var(--theme-primary)]"
                  : "text-on-surface-variant/40"
            }`}>
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${
                user.active ? "text-on-surface" : "text-on-surface-variant/50"
              }`}>
                {user.displayName}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                user.role === "admin"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-emerald-500/20 text-emerald-400"
              }`}>
                {user.role}
              </span>
              {!user.active && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-400">
                  Inactive
                </span>
              )}
              {isSelf && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-400">
                  You
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-on-surface-variant/60">
              @{user.username}
              {user.email ? ` · ${user.email}` : ""}
            </p>
            {user.lastLoginAt && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-on-surface-variant/40">
                <Clock size={10} />
                Last login: {formatDate(new Date(user.lastLoginAt))}
              </p>
            )}
            <p className="mt-0.5 text-[10px] text-on-surface-variant/30">
              Created: {formatDate(new Date(user.createdAt))}
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            <button
              onClick={onToggleActive}
              className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1.5 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-higher hover:text-on-surface"
            >
              {user.active ? <UserX size={12} /> : <UserCheck size={12} />}
              {user.active ? "Deactivate" : "Activate"}
            </button>
            {!isSelf && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1.5 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
              >
                <Trash2 size={12} />
                Delete
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant/50 hover:bg-surface-container-high hover:text-on-surface-variant transition-colors"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-outline-variant/40 bg-surface/95 backdrop-blur-2xl shadow-2xl">
                  <button
                    onClick={() => { setShowMenu(false); onResetPassword(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                  >
                    <Key size={14} />
                    Reset Password
                  </button>
                  <button
                    onClick={() => { setShowMenu(false); onToggleActive(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                  >
                    {user.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
                  {!isSelf && (
                    <button
                      onClick={() => { setShowMenu(false); onDelete(); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete User
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
