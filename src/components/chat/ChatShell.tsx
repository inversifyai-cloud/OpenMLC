"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSidebarOpen, sidebarStore } from "@/lib/sidebar-store";

export function ChatShell({ children }: { children: React.ReactNode }) {
  const open = useSidebarOpen();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (window.matchMedia("(min-width: 768px)").matches && sidebarStore.get()) {
        sidebarStore.set(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") sidebarStore.set(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches && sidebarStore.get()) {
      sidebarStore.set(false);
    }
  }, [pathname]);

  return (
    <div className="chat-app" data-sidebar-open={open ? "true" : "false"}>
      {children}
      <button
        type="button"
        aria-label="close sidebar"
        className="sidebar-backdrop"
        onClick={() => sidebarStore.set(false)}
      />
    </div>
  );
}

export function HamburgerButton() {
  const open = useSidebarOpen();
  return (
    <button
      type="button"
      className="hamburger mobile-only"
      onClick={() => sidebarStore.toggle()}
      aria-label={open ? "close sidebar" : "open sidebar"}
      aria-expanded={open}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    </button>
  );
}
