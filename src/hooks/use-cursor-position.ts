"use client";

import { useState, useEffect } from "react";

export interface CursorPosition {
  x: number;
  y: number;
}

export function useCursorPosition(): CursorPosition {
  const [position, setPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  const [target, setTarget] = useState<CursorPosition>({ x: 0, y: 0 });

  useEffect(() => {
    // Check for coarse pointer (touch devices)
    const coarsePointerMediaQuery = window.matchMedia("(pointer: coarse)");
    if (coarsePointerMediaQuery.matches) {
      return;
    }

    // Initialize to viewport center
    const initX = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
    const initY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;
    setPosition({ x: initX, y: initY });
    setTarget({ x: initX, y: initY });

    function handleMouseMove(e: MouseEvent) {
      setTarget({ x: e.clientX, y: e.clientY });
    }

    window.addEventListener("mousemove", handleMouseMove);

    // rAF loop for eased lerp
    let animationFrameId: number;
    const easeLoop = () => {
      setPosition((current) => {
        const factor = 0.08; // ~120ms follow lag
        return {
          x: current.x + (target.x - current.x) * factor,
          y: current.y + (target.y - current.y) * factor,
        };
      });
      animationFrameId = requestAnimationFrame(easeLoop);
    };
    animationFrameId = requestAnimationFrame(easeLoop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return position;
}
