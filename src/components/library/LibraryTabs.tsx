"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const TABS: ReadonlyArray<{ key: string; label: string; type: string | null }> = [
  { key: "all", label: "All", type: null },
  { key: "artifact", label: "Figures", type: "artifact" },
  { key: "research", label: "Research", type: "research" },
  { key: "browser", label: "Browsing", type: "browser" },
];

export function LibraryTabs() {
  const router = useRouter();
  const sp = useSearchParams();
  const active = sp?.get("type") ?? "all";

  const setTab = useCallback(
    (typeValue: string | null) => {
      const next = new URLSearchParams(sp?.toString() ?? "");
      if (typeValue) next.set("type", typeValue);
      else next.delete("type");
      next.delete("cursor");
      const qs = next.toString();
      router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
    },
    [router, sp],
  );

  return (
    <nav className="lib-tabs" aria-label="Library categories">
      {TABS.map((t) => {
        const isActive = (t.type ?? "all") === active;
        return (
          <button
            key={t.key}
            type="button"
            className={`lib-tab ${isActive ? "lib-tab--active" : ""}`}
            onClick={() => setTab(t.type)}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
