"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InboxMarkAllReadLink({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await fetch("/api/inbox/mark-all-read", { method: "POST" });
      router.refresh();
    } catch {
      // swallow — UI will simply not update
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="ibx-mark-all"
      onClick={onClick}
      disabled={disabled || busy}
      aria-disabled={disabled || busy}
    >
      <span className="ibx-mark-all__label">
        {busy ? "marking…" : "mark all read"}
      </span>
    </button>
  );
}
