"use client";

import { Sidebar } from "./sidebar";
import { StatusIndicators } from "./status-indicators";
import { WeatherBadge, HeaderThemeToggle, NotificationsBadge } from "./weather-badge";
import {
  Sprout, User, CalendarDays, BookOpen, MapPin, Package,
  Settings, Scan, Bell, Sun, LayoutGrid, Users, Shield,
} from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/stores/app-store";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PAGE_ICONS: Record<string, { icon: any; color: string }> = {
  "/home": { icon: Sprout, color: "text-emerald-400" },
  "/calendar": { icon: CalendarDays, color: "text-sky-400" },
  "/journal": { icon: BookOpen, color: "text-amber-400" },
  "/locations": { icon: MapPin, color: "text-rose-400" },
  "/inventory": { icon: Package, color: "text-violet-400" },
  "/settings": { icon: Settings, color: "text-slate-400" },
  "/profile": { icon: User, color: "text-indigo-400" },
  "/planner": { icon: LayoutGrid, color: "text-teal-400" },
  "/notifications": { icon: Bell, color: "text-pink-400" },
  "/identify": { icon: Scan, color: "text-cyan-400" },
  "/weather": { icon: Sun, color: "text-yellow-400" },
  "/share": { icon: Users, color: "text-blue-400" },
  "/admin": { icon: Shield, color: "text-purple-400" },
};

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/home": { title: "My Greenhouse", subtitle: "Manage your plant collection" },
  "/calendar": { title: "Calendar", subtitle: "Track care tasks and schedules" },
  "/planner": { title: "Garden Planner", subtitle: "Design your garden with square-foot precision" },
  "/notifications": { title: "Notifications", subtitle: "Stay updated on your garden" },
  "/identify": { title: "Identify Plants", subtitle: "AI-powered plant identification" },
  "/journal": { title: "Journal", subtitle: "Record your gardening journey" },
  "/locations": { title: "Plant Locations", subtitle: "Organize your growing spaces" },
  "/inventory": { title: "Inventory", subtitle: "Track your supplies and tools" },
  "/weather": { title: "Weather", subtitle: "Current conditions for your area" },
  "/share": { title: "Shared Garden", subtitle: "Collaborate with fellow gardeners" },
  "/settings": { title: "Settings", subtitle: "Customize your experience" },
  "/admin": { title: "Admin Dashboard", subtitle: "Manage users and view activity logs" },
  "/profile": { title: "Profile", subtitle: "Manage your account" },
};

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentUser = useAppStore((s) => s.currentUser);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const pageInfo = PAGE_TITLES[pathname] ?? { title: "REMI Bloom", subtitle: "" };
  const pageIcon = PAGE_ICONS[pathname] ?? { icon: Sprout, color: "text-[var(--theme-primary)]" };
  const IconComponent = pageIcon.icon;

  return (
    <div className="flex min-h-dvh bg-surface">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-surface focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]">
        Skip to content
      </a>
      <Sidebar />

      <div className={cn("flex flex-1 flex-col transition-all duration-300", sidebarCollapsed ? "ml-16" : "ml-60")}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant/40 bg-surface/80 px-6 py-3 backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--theme-primary)]/20">
              <IconComponent size={18} className={pageIcon.color} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface leading-tight">
                {pageInfo.title}
              </h2>
              {pageInfo.subtitle && (
                <p className="text-[10px] text-on-surface-variant/50 leading-tight hidden sm:block">
                  {pageInfo.subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <WeatherBadge />
            <NotificationsBadge />
            <HeaderThemeToggle />
            <Link
              href="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high/60 text-on-surface-variant transition-colors hover:bg-surface-container-higher hover:text-on-surface"
              aria-label="Profile"
            >
              {currentUser ? (
                <span className="text-[10px] font-bold text-[var(--theme-primary)]">
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User size={14} />
              )}
            </Link>
            <StatusIndicators />
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto p-6" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
