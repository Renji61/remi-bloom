"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import type { User } from "@/lib/db";

async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch("/api/profile", { credentials: "include" });
  if (!response.ok) return null;
  return response.json();
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
    async function check() {
      if (currentUser) {
        // Already authenticated
        if (requireAdmin && currentUser.role !== "admin") {
          router.replace("/home");
        }
        return;
      }

      const session = await fetchCurrentUser();
      if (session) {
        setCurrentUser(session);
        if (requireAdmin && session.role !== "admin") {
          router.replace("/home");
        }
      } else {
        router.replace("/login");
      }
    }
    check();
  }, [currentUser, setCurrentUser, router, requireAdmin]);
}
