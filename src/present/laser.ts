import { type PointerEvent, useEffect, useState } from "react";
import type { LaserPos, PresentClient } from "./client";

/** Position of the pointer over the slide box inside `stage` (0–1), or null outside it. */
export function slidePosition(e: PointerEvent<HTMLElement>): LaserPos | null {
  const box = e.currentTarget.querySelector(".stage-slide")?.getBoundingClientRect();
  if (!box || box.width === 0) return null;
  const x = (e.clientX - box.left) / box.width;
  const y = (e.clientY - box.top) / box.height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

/** L toggles the laser pointer (ignored while typing a slide number elsewhere). */
export function useLaserToggle(onToggle: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "l" || e.key === "L") && !e.ctrlKey && !e.metaKey && !e.altKey) onToggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);
}

/** Laser position sent by the presenter view (or another window). */
export function useRemoteLaser(client: PresentClient): LaserPos | null {
  const [pos, setPos] = useState<LaserPos | null>(null);
  useEffect(() => client.onLaser(setPos), [client]);
  return pos;
}
