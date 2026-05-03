"use client";

import { useState, useEffect } from "react";
import { useCursorPosition } from "@/hooks/use-cursor-position";

type Props = {
  hue: number;
};

export function AmbientOrb({ hue }: Props) {
  const { x, y } = useCursorPosition();
  // Defer media checks to client to avoid SSR hydration mismatch.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    setEnabled(!reducedMotion && !coarsePointer);
  }, []);

  if (!enabled) return null;

  const orbRadius = 400;
  const offsetX = x - orbRadius;
  const offsetY = y - orbRadius;

  return (
    <div className="ambient-orb">
      <div
        className="ambient-orb__blob"
        style={{
          "--orb-hue": hue,
          transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
        } as React.CSSProperties & Record<string, unknown>}
      />
    </div>
  );
}
