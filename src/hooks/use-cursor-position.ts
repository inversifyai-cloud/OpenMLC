"use client";

import { useRef, useState, useEffect } from "react";

export interface CursorPosition {
  x: number;
  y: number;
}

export function useCursorPosition(): CursorPosition {
  const [position, setPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  // Use a ref for the lerp target so the rAF closure always reads the latest value.
  const targetRef = useRef<CursorPosition>({ x: 0, y: 0 });

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const initX = window.innerWidth / 2;
    const initY = window.innerHeight / 2;
    targetRef.current = { x: initX, y: initY };
    setPosition({ x: initX, y: initY });

    function handleMouseMove(e: MouseEvent) {
      targetRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("mousemove", handleMouseMove);

    const FACTOR = 0.08;
    const EPSILON = 0.5;
    let posX = initX, posY = initY;
    let rafId: number;

    function easeLoop() {
      const dx = targetRef.current.x - posX;
      const dy = targetRef.current.y - posY;
      if (Math.abs(dx) > EPSILON || Math.abs(dy) > EPSILON) {
        posX += dx * FACTOR;
        posY += dy * FACTOR;
        setPosition({ x: posX, y: posY });
      }
      rafId = requestAnimationFrame(easeLoop);
    }
    rafId = requestAnimationFrame(easeLoop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return position;
}
