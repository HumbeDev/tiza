import { describe, expect, it } from "vitest";
import { applyNav } from "./client";

describe("applyNav", () => {
  const s = { index: 1, count: 3, blank: "none" as const };

  it("moves within range", () => {
    expect(applyNav(s, { kind: "next" }).index).toBe(2);
    expect(applyNav({ ...s, index: 2 }, { kind: "next" }).index).toBe(2);
    expect(applyNav({ ...s, index: 0 }, { kind: "prev" }).index).toBe(0);
    expect(applyNav(s, { kind: "goto", index: 50 }).index).toBe(2);
    expect(applyNav(s, { kind: "first" }).index).toBe(0);
    expect(applyNav(s, { kind: "last" }).index).toBe(2);
  });

  it("toggles blank screens and clears them when moving", () => {
    const black = applyNav(s, { kind: "black" });
    expect(black.blank).toBe("black");
    expect(applyNav(black, { kind: "black" }).blank).toBe("none");
    expect(applyNav(black, { kind: "white" }).blank).toBe("white");
    expect(applyNav(black, { kind: "next" })).toEqual({ index: 2, count: 3, blank: "none" });
  });
});
