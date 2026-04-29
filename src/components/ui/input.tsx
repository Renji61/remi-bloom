"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    const autoId = useId();
    const resolvedId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={resolvedId}
            className="text-xs font-semibold tracking-wider uppercase text-on-surface-variant"
          >
            {label}
          </label>
        )}
        <input
          id={resolvedId}
          ref={ref}
          className={cn(
            "w-full rounded-2xl border border-outline/30 bg-surface-container/60 px-4 py-3",
            "text-on-surface placeholder:text-on-surface-variant/50",
            "backdrop-blur-sm transition-all duration-200",
            "focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/20",
            "text-sm",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
