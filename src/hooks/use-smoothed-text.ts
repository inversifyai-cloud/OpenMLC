import { useEffect, useRef, useState } from "react";

/**
 * Smooths bursty streaming text into a steady character-per-second flow.
 *
 * Drains independently of the stream state: even when `streaming` flips to
 * false (fast models, instant responses), the rAF loop keeps revealing
 * characters at a steady CPS until display catches up to target, *then* exits.
 * That guarantees you always see the typewriter feel, never a blank-to-full
 * snap.
 */
export function useSmoothedText(target: string, streaming: boolean): string {
  const [display, setDisplay] = useState<string>(streaming ? "" : target);

  // Refs so the long-running rAF loop sees latest values without restarting.
  const targetRef = useRef(target);
  const displayRef = useRef(display);
  const streamingRef = useRef(streaming);
  const reducedMotionRef = useRef(false);

  targetRef.current = target;
  streamingRef.current = streaming;

  // If target shrinks (e.g. message replaced) reset display so we can re-reveal.
  if (display.length > target.length) {
    displayRef.current = "";
  }

  const loopActiveRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    if (reducedMotionRef.current) {
      displayRef.current = targetRef.current;
      setDisplay(targetRef.current);
      return;
    }

    // Only kick off a new rAF loop if one isn't already draining.
    if (loopActiveRef.current) return;
    if (
      displayRef.current.length >= targetRef.current.length &&
      !streamingRef.current
    ) {
      return;
    }

    loopActiveRef.current = true;
    let cancelled = false;
    let lastT = 0;
    let prerollUntil = 0;
    const PREROLL_MS = 350;

    const tick = (t: number) => {
      if (cancelled) return;

      const tgt = targetRef.current;
      const cur = displayRef.current;
      const isStreaming = streamingRef.current;

      // Nothing to reveal yet — wait
      if (tgt.length === 0) {
        lastT = 0;
        prerollUntil = 0;
        if (isStreaming || cur.length > 0) requestAnimationFrame(tick);
        return;
      }

      // Pre-roll only the very first time we have buffered text to show.
      // Don't pre-roll if streaming has already finished — drain immediately.
      if (cur.length === 0 && prerollUntil === 0 && isStreaming) {
        prerollUntil = t + PREROLL_MS;
      }
      if (prerollUntil && t < prerollUntil) {
        requestAnimationFrame(tick);
        return;
      }

      if (!lastT) lastT = t;
      const dt = (t - lastT) / 1000;
      lastT = t;

      if (cur.length < tgt.length) {
        const lag = tgt.length - cur.length;
        // Floor of ~80 cps so even small remaining text reveals visibly.
        // Scales with backlog so we catch up on long bursts without sprinting.
        const cps = Math.min(260, 80 + Math.sqrt(lag) * 22);
        const advance = Math.max(1, cps * dt);
        const newLen = Math.min(Math.ceil(cur.length + advance), tgt.length);
        const next = tgt.slice(0, newLen);
        displayRef.current = next;
        setDisplay(next);
      } else if (cur.length > tgt.length) {
        // Target shrank — re-sync.
        displayRef.current = tgt;
        setDisplay(tgt);
      }

      // Exit only when we've caught up AND the stream has settled.
      const caughtUp = displayRef.current.length >= targetRef.current.length;
      if (caughtUp && !streamingRef.current) {
        loopActiveRef.current = false;
        return;
      }
      requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      loopActiveRef.current = false;
      cancelAnimationFrame(id);
    };
    // Effect re-runs when streaming changes or when target gets ahead — the
    // guard at the top of the effect prevents stacking loops.
  }, [target, streaming]);

  return display;
}
