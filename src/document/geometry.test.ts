import { describe, expect, it } from "vitest";
import { aabb, resizeBox, rotationTowards, snapMove } from "./geometry";

describe("aabb", () => {
  it("is the box itself without rotation", () => {
    expect(aabb({ x: 10, y: 20, w: 30, h: 40, rotation: 0 })).toEqual({
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });

  it("swaps width and height at 90°", () => {
    const r = aabb({ x: 0, y: 0, w: 100, h: 20, rotation: 90 });
    expect(r.w).toBeCloseTo(20);
    expect(r.h).toBeCloseTo(100);
    expect(r.x).toBeCloseTo(40);
    expect(r.y).toBeCloseTo(-40);
  });
});

describe("snapMove", () => {
  const sel = { x: 100, y: 100, w: 100, h: 100 };

  it("snaps the left edge to a nearby target edge", () => {
    const r = snapMove(sel, 3, 0, [{ x: 0, y: 500, w: 105, h: 10 }], 8);
    expect(r.dx).toBe(5);
    expect(r.guidesX).toContain(105);
  });

  it("snaps centers", () => {
    const r = snapMove(sel, 0, 0, [{ x: 0, y: 0, w: 1920, h: 1080 }], 8);
    expect(r.dx).toBe(0);
    const r2 = snapMove(
      { x: 905, y: 0, w: 100, h: 100 },
      0,
      0,
      [{ x: 0, y: 0, w: 1920, h: 1080 }],
      8,
    );
    expect(r2.dx).toBe(5);
    expect(r2.guidesX).toEqual([960]);
  });

  it("leaves the move alone when nothing is close", () => {
    const r = snapMove(sel, 50, 50, [{ x: 1000, y: 1000, w: 10, h: 10 }], 8);
    expect(r).toEqual({ dx: 50, dy: 50, guidesX: [], guidesY: [] });
  });
});

describe("resizeBox", () => {
  const box = { x: 0, y: 0, w: 100, h: 50, rotation: 0 };

  it("drags the bottom-right corner", () => {
    expect(resizeBox(box, { x: 1, y: 1 }, { x: 150, y: 80 }, false)).toEqual({
      x: 0,
      y: 0,
      w: 150,
      h: 80,
      rotation: 0,
    });
  });

  it("drags the left edge keeping the right edge fixed", () => {
    const r = resizeBox(box, { x: -1, y: 0 }, { x: 20, y: 999 }, false);
    expect(r).toEqual({ x: 20, y: 0, w: 80, h: 50, rotation: 0 });
  });

  it("keeps the aspect ratio", () => {
    const r = resizeBox(box, { x: 1, y: 1 }, { x: 200, y: 60 }, true);
    expect(r.w).toBe(200);
    expect(r.h).toBe(100);
  });

  it("keeps the opposite corner fixed when rotated", () => {
    const rotated = { x: 0, y: 0, w: 100, h: 50, rotation: 90 };
    // Top-left corner in world space for a box rotated 90° around (50, 25).
    const topLeft = { x: 75, y: -25 };
    const r = resizeBox(rotated, { x: 1, y: 1 }, { x: 0, y: 200 }, false);
    const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    // Recompute the new top-left corner: local (-w/2, -h/2) rotated 90° = (h/2, -w/2).
    expect(c.x + r.h / 2).toBeCloseTo(topLeft.x);
    expect(c.y - r.w / 2).toBeCloseTo(topLeft.y);
  });

  it("never goes below the minimum size", () => {
    const r = resizeBox(box, { x: 1, y: 1 }, { x: -500, y: -500 }, false, 10);
    expect(r.w).toBe(10);
    expect(r.h).toBe(10);
  });
});

describe("rotationTowards", () => {
  const box = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };
  it("points up at 0°", () =>
    expect(rotationTowards(box, { x: 50, y: -100 }, null)).toBeCloseTo(0));
  it("points right at 90°", () =>
    expect(rotationTowards(box, { x: 500, y: 50 }, null)).toBeCloseTo(90));
  it("snaps to steps", () => expect(rotationTowards(box, { x: 500, y: 70 }, 15)).toBe(90));
});
