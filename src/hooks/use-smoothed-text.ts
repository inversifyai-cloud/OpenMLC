import { useEffect, useRef, useState } from "react";

/**
 * Smooths bursty streaming text into a steady character-per-second flow.
 *
 * AI tokens arrive in bursts (e.g. 30 chars at once, then 200ms idle, then 50 more).
 * This hook buffers the target text and emits it at a steady rate so the user sees
 * a typewriter-like reveal instead of stuttering chunks.
 *
 * Pre-roll: holds output empty for ~700ms after streaming starts so the first
 * tokens accumulate into a buffer. This is what prevents the early stutter when
 * the smoother would otherwise catch up to the target and have nothing to emit.
 *
 * The CPS rate auto-scales with backlog: bigger lag = faster catch-up. When
 * `streaming` flips to false, snaps to the full target instantly.
 */
export function useSmoothedText(target: string, streaming: boolean): string {
  const [display, setDisplay] = useState<string>(streaming ? "" : target);
  const targetRef = useRef(target);
  const displayRef = useRef(display);

  // Always keep latest target accessible to the rAF loop without restarting it.
  targetRef.current = target;

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    if (!streaming) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    // Pre-roll: do nothing for ~700ms so a buffer of tokens accumulates.
    // This kills the stutter at the start of every reply.
    const PREROLL_MS = 700;
    const startTime = performance.now();

    let cancelled = false;
    let lastT = 0;

    const tick = (t: number) => {
      if (cancelled) return;

      // Pre-roll phase — keep display empty, let the buffer build.
      if (t - startTime < PREROLL_MS) {
        requestAnimationFrame(tick);
        return;
      }

      if (!lastT) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;

      const tgt = targetRef.current;
      const cur = displayRef.current;

      if (cur.length < tgt.length) {
        const lag = tgt.length - cur.length;
        // Conservative base rate so we don't outrun the incoming token stream.
        // Scales gently with backlog; caps prevent jarring sprints.
        const cps = Math.min(220, 55 + Math.sqrt(lag) * 18);
        const advance = Math.max(1, cps * dt);
        const newLen = Math.min(Math.ceil(cur.length + advance), tgt.length);
        const next = tgt.slice(0, newLen);
        if (next !== cur) {
          displayRef.current = next;
          setDisplay(next);
        }
      } else if (cur.length > tgt.length) {
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
