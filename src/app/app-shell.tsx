"use client";

import { useOffline } from "@/hooks/use-offline";
import { usePathname } from "next/navigation";
import { MobileShell } from "@/components/layout/mobile-shell";
import { DesktopShell } from "@/components/layout/desktop-shell";
import { WeatherFetcher } from "@/components/layout/weather-badge";
import { useWeatherTrigger } from "@/hooks/use-weather-trigger";
import { useReminderTrigger } from "@/hooks/use-reminder-trigger";
import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { loadUserData } from "@/lib/load-user-data";
import { useSession } from "next-auth/react";

const AUTH_PAGES = new Set(["/login", "/register"]);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.has(pathname);
  const [isDesktop, setIsDesktop] = useState(false);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  const { data: session, status } = useSession();

  useOffline();

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Sync NextAuth session to Zustand store
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id && !currentUserId) {
      // Create a user-like object for the store
      const userObj = {
        id: session.user.id,
        username: (session.user as any).username ?? "",
        displayName: session.user.name ?? "",
        role: (session.user as any).role ?? "user",
        email: session.user.email ?? "",
        avatar: "",
        active: true,
        passwordHash: "",
        lastLoginAt: null,
        createdAt: "",
        updatedAt: "",
      };
      setCurrentUser(userObj);
    }
  }, [status, session, currentUserId, setCurrentUser]);

  // Load per-user data when user is known
  useEffect(() => {
    if (currentUserId) {
      loadUserData(currentUserId);
    }
  }, [currentUserId]);

  useEffect(() => {
    document.documentElement.classList.toggle("md", isDesktop);
  }, [isDesktop]);

  // Auth pages (login) render without shell
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="block md:hidden">
        <MobileShell>{children}</MobileShell>
      </div>
      <div className="hidden md:block">
        <DesktopShell>{children}</DesktopShell>
      </div>
      <WeatherFetcher />
      <NotifTriggers />
    </>
  );
}

/** Invisible component that mounts the notification trigger hooks. */
function NotifTriggers() {
  useWeatherTrigger();
  useReminderTrigger();
  return null;
}
