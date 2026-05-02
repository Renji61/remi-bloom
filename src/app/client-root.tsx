"use client";

import dynamic from "next/dynamic";
import { MotionConfig } from "framer-motion";
import { SessionProvider } from "next-auth/react";
import { ConfirmProvider } from "@/components/ui";

const ThemeProvider = dynamic(() => import("./theme-provider"), { ssr: false });
const AppShell = dynamic(() => import("./app-shell"), { ssr: false });

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <ConfirmProvider>
            <AppShell>{children}</AppShell>
          </ConfirmProvider>
        </ThemeProvider>
      </MotionConfig>
    </SessionProvider>
  );
}
