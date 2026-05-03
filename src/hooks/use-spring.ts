"use client";

import { useEffect, useRef, useState } from "react";

// Tiny spring physics primitive — no external lib. Drives a single number
// toward a target with stiffness/damping/mass, returns the live value via
// useState (subscribed to a shared rAF runner so 100+ springs only spin
// up one rAF loop).
//
// Example:
//   const x = useSpring(active ? 100 : 0, { stiffness: 220, damping: 24 });

export type SpringConfig = {
  stiffness?: number; // default 200
  damping?: number;   // default 22
  mass?: number;      // default 1
  precision?: number; // sleep threshold, default 0.01
};

const DEFAULTS: Required<SpringConfig> = {
  stiffness: 200,
  damping: 22,
  mass: 1,
  precision: 0.01,
};

// ── Shared rAF runner ────────────────────────────────────────────────────
type Spring = {
  current: number;
  velocity: number;
  target: number;
  cfg: Required<SpringConfig>;
  notify: (v: number) => void;
};

const active = new Set<Spring>();
let rafId: number | null = null;
let lastT = 0;

function tick(t: number) {
  const dt = lastT ? Math.min((t - lastT) / 1000, 1 / 30) : 1 / 60;
  lastT = t;

  for (const s of active) {
    const { stiffness, damping, mass, precision } = s.cfg;
    const dx = s.target - s.current;
    const force = stiffness * dx;
    const friction = damping * s.velocity;
    const accel = (force - friction) / mass;
    s.velocity += accel * dt;
    s.current += s.velocity * dt;

    if (Math.abs(dx) < precision && Math.abs(s.velocity) < precision) {
      s.current = s.target;
      s.velocity = 0;
      s.notify(s.current);
      active.delete(s);
    } else {
      s.notify(s.current);
    }
  }

  if (active.size > 0) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = null;
    lastT = 0;
  }
}

function ensureRunning() {
  if (rafId == null && active.size > 0) {
    lastT = 0;
    rafId = requestAnimationFrame(tick);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useSpring(target: number, config?: SpringConfig): number {
  const cfg = { ...DEFAULTS, ...config };
  const [value, setValue] = useState(target);
  const springRef = useRef<Spring | null>(null);

  // Lazily create the spring (initialized at the first target)
  if (!springRef.current) {
    springRef.current = {
      current: target,
      velocity: 0,
      target,
      cfg,
      notify: setValue,
    };
  }

  useEffect(() => {
    const s = springRef.current!;
    s.target = target;
    s.cfg = cfg;
    if (Math.abs(s.current - target) > cfg.precision || Math.abs(s.velocity) > cfg.precision) {
      active.add(s);
      ensureRunning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, cfg.stiffness, cfg.damping, cfg.mass]);

  // Stop animating on unmount
  useEffect(() => {
    return () => {
      if (springRef.current) active.delete(springRef.current);
    };
  }, []);

  return value;
}
