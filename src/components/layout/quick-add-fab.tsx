"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Sprout,
  CheckSquare,
  MapPin,
  Package,
  Bell,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Sprout;
  href: string;
  color: string;
}

const quickActions: QuickAction[] = [
  { id: "plant", label: "Add Plant", icon: Sprout, href: "/greenhouse?add=true", color: "var(--theme-primary)" },
  { id: "todo", label: "Add Action", icon: CheckSquare, href: "/calendar?add=true", color: "#34d399" },
  { id: "location", label: "Add Location", icon: MapPin, href: "/locations?add=true", color: "#60a5fa" },
  { id: "inventory", label: "Add Inventory", icon: Package, href: "/inventory?add=true", color: "#f472b6" },
  { id: "reminder", label: "Set Reminder", icon: Bell, href: "/reminders?add=true", color: "#fbbf24" },
];

const fabVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0, opacity: 0 },
};

const actionVariants = {
  initial: { scale: 0, opacity: 0, y: 10 },
  animate: (i: number) => ({
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, type: "spring", stiffness: 300, damping: 25 },
  }),
  exit: { scale: 0, opacity: 0, transition: { duration: 0.15 } },
};

export function QuickAddFab() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleAction = useCallback(
    (action: QuickAction) => {
      setOpen(false);
      router.push(action.href);
    },
    [router]
  );

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col-reverse items-end gap-2 md:bottom-8 md:right-8">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-2 flex flex-col gap-2"
          >
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  custom={i}
                  variants={actionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  onClick={() => handleAction(action)}
                  className="group flex items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface/90 px-4 py-2.5 shadow-lg shadow-black/30 backdrop-blur-xl transition-all hover:bg-surface-container-high hover:scale-105"
                  style={{ borderColor: action.color + "30" }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: action.color + "20" }}
                  >
                    <Icon size={16} style={{ color: action.color }} />
                  </div>
                  <span className="whitespace-nowrap text-xs font-semibold text-on-surface">
                    {action.label}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB Button */}
      <motion.button
        variants={fabVariants}
        initial="animate"
        animate="animate"
        onClick={() => setOpen(!open)}
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          backgroundColor: "var(--theme-primary)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Plus size={24} className="text-[var(--theme-onPrimary)]" />
        </motion.div>

        {/* Ripple rings */}
        <span className="absolute inset-0 animate-ping rounded-2xl opacity-20"
          style={{ backgroundColor: "var(--theme-primary)" }}
        />
      </motion.button>
    </div>
  );
}
