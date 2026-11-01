import { describe, expect, it } from "vitest";
import { applyNav } from "./client";

describe("applyNav", () => {
  const s = { index: 1, count: 3, step: 0, blank: "none" as const };
  const none = [0, 0, 0];

  it("moves within range", () => {
    expect(applyNav(s, { kind: "next" }, none).index).toBe(2);
    expect(applyNav({ ...s, index: 2 }, { kind: "next" }, none).index).toBe(2);
    expect(applyNav({ ...s, index: 0 }, { kind: "prev" }, none).index).toBe(0);
    expect(applyNav(s, { kind: "goto", index: 50 }, none).index).toBe(2);
    expect(applyNav(s, { kind: "first" }, none).index).toBe(0);
    expect(applyNav(s, { kind: "last" }, none).index).toBe(2);
  });

  it("toggles blank screens and clears them when moving", () => {
    const black = applyNav(s, { kind: "black" }, none);
    expect(black.blank).toBe("black");
    expect(applyNav(black, { kind: "black" }, none).blank).toBe("none");
    expect(applyNav(black, { kind: "white" }, none).blank).toBe("white");
    expect(applyNav(black, { kind: "next" }, none)).toEqual({
      index: 2,
      count: 3,
      step: 0,
      blank: "none",
    });
  });

  it("reveals builds before moving on, and goes back like Beamer", () => {
    const steps = [2, 0];
    let st = { index: 0, count: 2, step: 0, blank: "none" as const };
    const seen: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      st = applyNav(st, { kind: "next" }, steps) as typeof st;
      seen.push([st.index, st.step]);
    }
    expect(seen).toEqual([
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 0],
    ]);
    st = applyNav(st, { kind: "prev" }, steps) as typeof st;
    expect([st.index, st.step]).toEqual([0, 2]);
  });
});
