import { describe, expect, it } from "vitest";
import { INLINE_MATH_INPUT } from "./inlineMath";

// The input rule sees the text before the cursor plus the character just typed.
const latexOf = (text: string) => text.match(INLINE_MATH_INPUT)?.[1] ?? null;

describe("inline math input rule", () => {
  it("matches $…$ after a space or at the start", () => {
    expect(latexOf("La energía es $E=mc^2$")).toBe("E=mc^2");
    expect(latexOf("$x$")).toBe("x");
  });

  it("only takes the last formula", () => {
    expect(latexOf("$a$ y $b^2$")).toBe("b^2");
  });

  it("ignores prices and lone dollar signs", () => {
    expect(latexOf("cuesta $5 y $")).toBeNull();
    expect(latexOf("US$10$")).toBeNull();
    expect(latexOf("$$")).toBeNull();
  });
});
