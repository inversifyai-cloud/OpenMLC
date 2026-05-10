"use client";

import { useState } from "react";

export function CopyButton({ value, label = "copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {/* noop */}
  }

  return (
    <button type="button" className="cdn-copy" onClick={copy} aria-label={label}>
      {copied ? "copied" : label}
    </button>
  );
}
