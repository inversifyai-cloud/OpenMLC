"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Small unread dot beside an inbox link in the top rail.
// Polls /api/inbox?unread=1&take=0 every 30s; revalidates on route change.
export function InboxBadge() {
  const [count, setCount] = useState<number>(0);
  const pathname = usePathname();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch("/api/inbox?unread=1&take=0", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unreadCount?: number };
        if (cancelled || !mounted.current) return;
        if (typeof data.unreadCount === "number") setCount(data.unreadCount);
      } catch {
        // network failures are ignored; keep last known count
      }
    }
    fetchCount();
    const t = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pathname]);

  const isActive = pathname === "/inbox";

  return (
    <Link
      href="/inbox"
      className={`ico-btn ibx-badge-link ${isActive ? "ibx-badge-link--active" : ""}`}
      aria-label={count > 0 ? `inbox (${count} unread)` : "inbox"}
      title={count > 0 ? `inbox · ${count} unread` : "inbox"}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 13h5l1.5 3h5L16 13h5" />
        <path d="M5 13 7 5h10l2 8" />
        <path d="M3 13v6h18v-6" />
      </svg>
      {count > 0 ? <span className="ibx-badge-dot" aria-hidden /> : null}
    </Link>
  );
}
