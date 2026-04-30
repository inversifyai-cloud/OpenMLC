"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function LibraryFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const initial = sp?.get("q") ?? "";
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(sp?.get("q") ?? "");
  }, [sp]);

  const commit = useCallback(
    (next: string) => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      const trimmed = next.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("cursor");
      const qs = params.toString();
      router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
    },
    [router, sp],
  );

  return (
    <form
      className="lib-filters"
      onSubmit={(e) => {
        e.preventDefault();
        commit(value);
      }}
      role="search"
    >
      <label className="lib-search">
        <svg
          className="lib-search__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="10" cy="10" r="6" />
          <path d="M14.5 14.5l5 5" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit(value)}
          placeholder="search the library"
          aria-label="search library"
          spellCheck={false}
        />
        {value ? (
          <button
            type="button"
            className="lib-search__clear"
            onClick={() => {
              setValue("");
              commit("");
            }}
            aria-label="clear search"
          >
            ×
          </button>
        ) : null}
      </label>
    </form>
  );
}
