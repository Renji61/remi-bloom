"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  TrendingUp,
  Sun,
  Users,
  Sparkles,
  User,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIndicators } from "./status-indicators";
import { WeatherBadge, HeaderThemeToggle, NotificationsBadge } from "./weather-badge";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/app-store";

const mainNavItems = [
  { href: "/home", label: "Home", icon: Sprout },
  { href: "/calendar", label: "Cal", icon: Calendar },
  { href: "/planner", label: "Garden", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
];

const subNavItems = [
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/weather", label: "Weather", icon: Sun },
  { href: "/share", label: "Share", icon: Users },
  { href: "/identify", label: "Identify", icon: Scan },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-surface focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]">
        Skip to content
      </a>
      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant/40 bg-surface/80 px-5 py-3 backdrop-blur-lg" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--theme-primary)]/20">
            <Sprout size={16} className="text-[var(--theme-primary)]" />
          </div>
          <span className="text-sm font-bold tracking-wide text-[var(--theme-primary)]">
            REMI Bloom
          </span>
        </div>
        <div className="flex items-center gap-3">
          <WeatherBadge />
          <NotificationsBadge />
          <HeaderThemeToggle />
          <StatusIndicators />
        </div>
      </header>

      {/* Top Sub Navigation (for secondary pages) */}
      <nav aria-label="Secondary pages" className="flex gap-1 overflow-x-auto hide-scrollbar border-b border-outline-variant/40 px-4 py-2">
        {subNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all",
                pathname === item.href
                  ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                  : "text-on-surface-variant/60 hover:text-on-surface-variant"
              )}
            >
              <Icon size={12} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        {/* Admin link — only visible to admin users */}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all",
              pathname === "/admin"
                ? "bg-purple-500/20 text-purple-400"
                : "text-on-surface-variant/60 hover:text-on-surface-variant"
            )}
          >
            <Shield size={12} aria-hidden="true" />
            Admin
          </Link>
        )}
      </nav>

      {/* Main Content */}
      <main id="main-content" className="flex-1 overflow-y-auto px-4 py-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }} tabIndex={-1}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav aria-label="Main navigation" className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
        <div className="flex items-center justify-around rounded-2xl border border-outline-variant/40 bg-surface/80 px-2 py-2 backdrop-blur-lg shadow-2xl shadow-black/30">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all duration-200",
                  isActive
                    ? "text-[var(--theme-primary)]"
                    : "text-on-surface-variant/60 hover:text-on-surface-variant"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2 : 1.5} aria-hidden="true" />
                <span className="text-[9px] font-semibold tracking-wider uppercase">
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="mt-0.5 h-1 w-1 rounded-full bg-[var(--theme-primary)] shadow-[0_0_6px_var(--theme-primary)]"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
