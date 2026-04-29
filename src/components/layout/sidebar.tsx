"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Sprout,
  LayoutGrid,
  Scan,
  BookOpen,
  MapPin,
  Package,
  Settings,
  Calendar,
  Bell,
  CheckSquare,
  Sun,
  Users,
  Sparkles,
  User,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/app-store";

const navItems = [
  { href: "/home", label: "Home", icon: Sprout },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/planner", label: "Garden", icon: LayoutGrid },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/identify", label: "Identify Plants", icon: Scan },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/weather", label: "Weather", icon: Sun },
  { href: "/share", label: "Share", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === "admin";

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-outline-variant/40 bg-surface/80 backdrop-blur-lg transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center justify-between border-b border-outline-variant/40 px-4 py-3">
        {!collapsed && (
          <span className="text-sm font-bold tracking-wider text-[var(--theme-primary)]">
            REMI Bloom
          </span>
        )}
        <button
          onClick={() => setSidebarCollapsed(!collapsed)}
          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
      </div>

      <nav aria-label="Main pages" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              )}
            >
              <Icon size={20} aria-hidden="true" />
              {!collapsed && <span>{item.label}</span>}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-main"
                  className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-[var(--theme-primary)]"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}

        {/* Admin link — only visible to admin users */}
        {isAdmin && (
          <>
            <div className="my-1 border-t border-outline-variant/40" />
            <Link
              href="/admin"
              aria-label={collapsed ? "Admin" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                pathname === "/admin"
                  ? "bg-purple-500/10 text-purple-400"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              )}
            >
              <Shield size={20} aria-hidden="true" />
              {!collapsed && <span>Admin</span>}
              {pathname === "/admin" && (
                <motion.div
                  layoutId="sidebar-active-admin"
                  className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-purple-400"
                  aria-hidden="true"
                />
              )}
            </Link>
          </>
        )}
      </nav>

      {/* Bottom section: Profile + version */}
      <div className="border-t border-outline-variant/40 px-3 py-2 space-y-1">
        <Link
          href="/profile"
          aria-label={collapsed ? "Profile" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200",
            pathname === "/profile"
              ? "bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]"
              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-high/80">
            {currentUser ? (
              <span className="text-[10px] font-bold text-[var(--theme-primary)]">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User size={16} aria-hidden="true" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">
                {currentUser?.displayName || "Profile"}
              </p>
              <p className="text-[9px] text-on-surface-variant/50 truncate">
                @{currentUser?.username || "sign in"}
              </p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <p className="px-2 text-[9px] text-on-surface-variant/30">
            REMI Bloom v1.0.0
          </p>
        )}
      </div>
    </aside>
  );
}
