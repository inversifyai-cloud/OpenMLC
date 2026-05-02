import { useEffect, useRef, useState } from "react";

/**
 * Smooths bursty streaming text into a steady character-per-second flow.
 *
 * AI tokens arrive in bursts (e.g. 30 chars at once, then 200ms idle, then 50 more).
 * This hook buffers the target text and emits it at a steady rate so the user sees
 * a typewriter-like reveal instead of stuttering chunks.
 *
 * The CPS rate auto-scales with backlog: bigger lag = faster catch-up, but never
 * so fast it feels jarring. When `streaming` flips to false, snaps to the full target.
 */
export function useSmoothedText(target: string, streaming: boolean): string {
  const [display, setDisplay] = useState<string>(streaming ? "" : target);
  const targetRef = useRef(target);
  const displayRef = useRef(display);

  // Always keep latest target accessible to the rAF loop without restarting it.
  targetRef.current = target;

  useEffect(() => {
    // Respect reduced-motion: skip animation entirely.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    if (!streaming) {
      // Stream ended — snap to full target so nothing is left in the buffer.
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    let cancelled = false;
    let lastT = 0;

    const tick = (t: number) => {
      if (cancelled) return;
      if (!lastT) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;

      const tgt = targetRef.current;
      const cur = displayRef.current;

      if (cur.length < tgt.length) {
        const lag = tgt.length - cur.length;
        // Base ~80 cps, ramp up with sqrt(backlog) so big lags catch up gracefully.
        const cps = 80 + Math.sqrt(lag) * 25;
        const advance = Math.max(1, cps * dt);
        const newLen = Math.min(Math.ceil(cur.length + advance), tgt.length);
        const next = tgt.slice(0, newLen);
        if (next !== cur) {
          displayRef.current = next;
          setDisplay(next);
        }
      } else if (cur.length > tgt.length) {
        // Target shrank (e.g. message reset) — snap.
        displayRef.current = tgt;
        setDisplay(tgt);
      }

      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming]);

  return display;
}
