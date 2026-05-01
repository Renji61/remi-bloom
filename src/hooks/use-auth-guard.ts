"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import type { User } from "@/lib/db";

async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch("/api/profile", { credentials: "include" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Hook that guards a page behind authentication.
 * If the user is not logged in, they are redirected to /login.
 *
 * Optionally checks for admin role.
 */
export function useAuthGuard(requireAdmin = false) {
  const router = useRouter();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (currentUser) {
        if (requireAdmin && currentUser.role !== "admin") {
          router.replace("/home");
        }
        return;
      }

      const session = await fetchCurrentUser();
      if (cancelled) return;
      if (session) {
        setCurrentUser(session);
        if (requireAdmin && session.role !== "admin") {
          router.replace("/home");
        }
      } else {
        router.replace("/login");
      }
    }

    check().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser, setCurrentUser, router, requireAdmin]);
}
