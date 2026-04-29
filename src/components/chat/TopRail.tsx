"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/chrome/ThemeToggle";

export function TopRail() {
  const pathname = usePathname();
  const inSettings = pathname?.startsWith("/settings");
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <span className="brand-name">openmlc</span>
        </div>
      </div>
      <div className="topbar-right">
        <ThemeToggle className="ico-btn" />
        <Link
          href={inSettings ? "/chat" : "/settings/api-keys"}
          className="ico-btn"
          aria-label={inSettings ? "back to chat" : "settings"}
          title={inSettings ? "back to chat" : "settings"}
        >
          {inSettings ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
              <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
              <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
              <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
            </svg>
          )}
        </Link>
      </div>
    </header>
  );
}
