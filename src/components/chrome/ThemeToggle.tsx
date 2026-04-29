"use client";

import { useTheme } from "@/app/providers";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14a8 8 0 11-10-10 6 6 0 0010 10z" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      suppressHydrationWarning
      onClick={() => mounted && setTheme(next)}
      aria-label="toggle theme"
      title={mounted ? `switch to ${next} theme` : "toggle theme"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-r2 text-fg-2 hover:text-fg-1 hover:bg-surface-hover transition-colors",
        className
      )}
      style={{ transitionDuration: "var(--dur-1)" }}
    >
      <span suppressHydrationWarning>
        {!mounted ? <MoonIcon /> : isDark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}
