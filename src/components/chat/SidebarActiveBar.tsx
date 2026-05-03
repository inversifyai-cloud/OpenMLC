"use client";

import { useEffect, useRef, useState } from "react";
import { useSpring } from "@/hooks/use-spring";

// Single moving accent bar that slides between conversation rows when the
// active conversation changes. Avoids per-row repaint by sharing one DOM node
// driven by spring physics. Mounted once in ChatSidebar; positions itself
// relative to the row matching `activeId`.

type Props = {
  containerRef: React.RefObject<HTMLElement | null>;
  activeId: string | null;
};

export function SidebarActiveBar({ containerRef, activeId }: Props) {
  const [target, setTarget] = useState<{ top: number; height: number } | null>(null);
  const measureRaf = useRef<number | null>(null);

  // Measure the active row's position whenever activeId or layout changes
  useEffect(() => {
    function measure() {
      const container = containerRef.current;
      if (!container || !activeId) {
        setTarget(null);
        return;
      }
      const row = container.querySelector<HTMLElement>(`[data-conv-id="${CSS.escape(activeId)}"]`);
      if (!row) {
        setTarget(null);
        return;
      }
      const cRect = container.getBoundingClientRect();
      const rRect = row.getBoundingClientRect();
      setTarget({
        top: rRect.top - cRect.top + container.scrollTop,
        height: rRect.height,
      });
    }

    measure();

    // Recompute on resize / scroll / layout change
    const obs = new ResizeObserver(() => {
      if (measureRaf.current != null) cancelAnimationFrame(measureRaf.current);
      measureRaf.current = requestAnimationFrame(measure);
    });
    if (containerRef.current) obs.observe(containerRef.current);

    return () => {
      obs.disconnect();
      if (measureRaf.current != null) cancelAnimationFrame(measureRaf.current);
    };
  }, [activeId, containerRef]);

  // Spring the y position of the bar
  const y = useSpring(target?.top ?? 0, { stiffness: 320, damping: 28 });
  const h = useSpring(target?.height ?? 0, { stiffness: 320, damping: 28 });

  if (!target) return null;

  return (
    <span
      className="sidebar-active-bar"
      aria-hidden
      style={{
        transform: `translateY(${y}px)`,
        height: `${h}px`,
      }}
    />
  );
}
