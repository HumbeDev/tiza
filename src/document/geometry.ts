export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEG = Math.PI / 180;

export function rotatePoint(p: Point, deg: number): Point {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export const center = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Axis-aligned bounding box of a (possibly rotated) box. */
export function aabb(b: Box): Rect {
  const c = center(b);
  const corners = [
    { x: -b.w / 2, y: -b.h / 2 },
    { x: b.w / 2, y: -b.h / 2 },
    { x: b.w / 2, y: b.h / 2 },
    { x: -b.w / 2, y: b.h / 2 },
  ].map((p) => rotatePoint(p, b.rotation));
  const xs = corners.map((p) => p.x + c.x);
  const ys = corners.map((p) => p.y + c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function union(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** x positions of vertical guide lines and y positions of horizontal ones. */
  guidesX: number[];
  guidesY: number[];
}

function snapAxis(moving: number[], targets: number[], threshold: number) {
  let best: { delta: number; at: number } | null = null;
  for (const m of moving) {
    for (const t of targets) {
      const delta = t - m;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, at: t };
      }
    }
  }
  return best;
}

/**
 * Adjusts a move of `selection` by (dx, dy) so that its edges or center line up with
 * the edges or centers of `targets` when they are within `threshold`.
 */
export function snapMove(
  selection: Rect,
  dx: number,
  dy: number,
  targets: Rect[],
  threshold: number,
): SnapResult {
  const moved = { ...selection, x: selection.x + dx, y: selection.y + dy };
  const xs = (r: Rect) => [r.x, r.x + r.w / 2, r.x + r.w];
  const ys = (r: Rect) => [r.y, r.y + r.h / 2, r.y + r.h];
  const sx = snapAxis(xs(moved), targets.flatMap(xs), threshold);
  const sy = snapAxis(ys(moved), targets.flatMap(ys), threshold);
  const final = {
    ...moved,
    x: moved.x + (sx?.delta ?? 0),
    y: moved.y + (sy?.delta ?? 0),
  };
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const guidesX = sx
    ? [...new Set(xs(final).filter((v) => targets.flatMap(xs).some((t) => near(t, v))))]
    : [];
  const guidesY = sy
    ? [...new Set(ys(final).filter((v) => targets.flatMap(ys).some((t) => near(t, v))))]
    : [];
  return { dx: dx + (sx?.delta ?? 0), dy: dy + (sy?.delta ?? 0), guidesX, guidesY };
}

/** Resize handle direction: -1, 0 or 1 on each axis (e.g. {x: 1, y: 1} is bottom-right). */
export interface Handle {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

/**
 * Resizes a rotated box by dragging `handle` to `pointer` (slide coordinates),
 * keeping the opposite side or corner fixed.
 */
export function resizeBox(
  box: Box,
  handle: Handle,
  pointer: Point,
  keepRatio: boolean,
  minSize = 4,
): Box {
  const c = center(box);
  const local = rotatePoint({ x: pointer.x - c.x, y: pointer.y - c.y }, -box.rotation);
  const anchor = { x: (-handle.x * box.w) / 2, y: (-handle.y * box.h) / 2 };

  let w = handle.x ? Math.max(minSize, handle.x * (local.x - anchor.x)) : box.w;
  let h = handle.y ? Math.max(minSize, handle.y * (local.y - anchor.y)) : box.h;

  if (keepRatio && box.w > 0 && box.h > 0) {
    const s =
      handle.x && handle.y ? Math.max(w / box.w, h / box.h) : handle.x ? w / box.w : h / box.h;
    w = Math.max(minSize, box.w * s);
    h = Math.max(minSize, box.h * s);
  }

  const localCenter = {
    x: handle.x ? anchor.x + (handle.x * w) / 2 : 0,
    y: handle.y ? anchor.y + (handle.y * h) / 2 : 0,
  };
  const offset = rotatePoint(localCenter, box.rotation);
  const nc = { x: c.x + offset.x, y: c.y + offset.y };
  return { x: nc.x - w / 2, y: nc.y - h / 2, w, h, rotation: box.rotation };
}

/** Rotation (degrees, 0..360) that points the box's top towards `pointer`. */
export function rotationTowards(box: Box, pointer: Point, step: number | null): number {
  const c = center(box);
  let deg = Math.atan2(pointer.y - c.y, pointer.x - c.x) / DEG + 90;
  if (step) deg = Math.round(deg / step) * step;
  else {
    const nearest = Math.round(deg / 90) * 90;
    if (Math.abs(deg - nearest) < 3) deg = nearest;
  }
  return ((deg % 360) + 360) % 360;
}
