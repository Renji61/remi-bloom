"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            primary:
              "bg-[var(--theme-primary)] text-[var(--theme-onPrimary)] hover:opacity-90 active:scale-[0.97]",
            secondary:
              "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest active:scale-[0.97]",
            ghost:
              "text-on-surface-variant hover:bg-surface-container-high active:scale-[0.97]",
            danger:
              "bg-error-container text-on-error-container hover:opacity-90 active:scale-[0.97]",
          }[variant],
          {
            sm: "h-8 px-4 text-xs gap-1.5",
            md: "h-10 px-5 text-sm gap-2",
            lg: "h-12 px-6 text-base gap-2.5",
          }[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps };
