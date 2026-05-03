"use client";

import { useCursorPosition } from "@/hooks/use-cursor-position";

type Props = {
  hue: number;
};

export function AmbientOrb({ hue }: Props) {
  const { x, y } = useCursorPosition();

  // Check if reduced motion is enabled
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Check for coarse pointer (touch devices)
  const coarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  if (reducedMotion || coarsePointer) {
    return null;
  }

  const orbRadius = 400; // 800px diameter / 2
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
