import { cn } from "@/lib/cn";
import { forwardRef } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-[14px]",
  lg: "h-12 px-5 text-[15px]",
};

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-fg-1 text-fg-inverse hover:brightness-110 active:brightness-95 shadow-[var(--shadow-2)]",
  ghost:
    "bg-transparent text-fg-1 hover:bg-surface-hover active:bg-surface-press",
  outline:
    "bg-transparent text-fg-1 border border-stroke-2 hover:bg-surface-hover active:bg-surface-press",
  danger:
    "bg-[var(--signal-err)] text-fg-inverse hover:brightness-110 active:brightness-95",
};

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "primary", size = "md", className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-r3 font-medium lowercase transition-all",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stroke-focus)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          SIZE[size],
          VARIANT[variant],
          className
        )}
        style={{ transitionDuration: "var(--dur-1)" }}
        {...rest}
      >
        {children}
      </button>
    );
  }
);
