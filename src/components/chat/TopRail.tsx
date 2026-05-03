"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/chrome/ThemeToggle";
import { HamburgerButton } from "@/components/chat/ChatShell";
import { InboxBadge } from "@/components/inbox/InboxBadge";
import { useFocusMode } from "@/hooks/use-focus-mode";

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "home" },
  { href: "/chat", label: "chat" },
  { href: "/spaces", label: "spaces" },
  { href: "/library", label: "library" },
  { href: "/search", label: "search" },
  { href: "/inbox", label: "inbox" },
];

export function TopRail() {
  const pathname = usePathname();
  const inSettings = pathname?.startsWith("/settings");
  const { level, cycle } = useFocusMode();

  function isActive(href: string): boolean {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function getFocusIcon() {
    switch (level) {
      case "default":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" />
          </svg>
        );
      case "focus":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="2" y1="6" x2="22" y2="6" />
            <line x1="2" y1="18" x2="22" y2="18" />
          </svg>
        );
      case "zen":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M9 10l-1-1M16 10l1-1M9 15c.5 1 1.5 2 3 2s2.5-1 3-2" />
          </svg>
        );
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <HamburgerButton />
        <div className="brand">
          <span className="brand-name">openmlc</span>
        </div>
        <nav className="topbar-nav" aria-label="primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`topbar-nav__link${isActive(l.href) ? " is-active" : ""}`}
              prefetch={false}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="topbar-right">
        <InboxBadge />
        <ThemeToggle className="ico-btn" />
        <button
          type="button"
          className="focus-toggle-btn ico-btn"
          onClick={cycle}
          aria-label="toggle focus mode"
          title="Focus mode (⌘.)"
        >
          {getFocusIcon()}
        </button>
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
