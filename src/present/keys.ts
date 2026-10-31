import type { NavAction } from "./client";

/**
 * Presentation keys (PROYECTO.md §7.6). Clickers send PageUp/PageDown (sometimes arrows,
 * B or "." for blank). Typing a number then Enter jumps to that slide.
 */
export function keyAction(e: KeyboardEvent, typedNumber: string): NavAction | "end" | null {
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case " ":
    case "n":
    case "N":
      return { kind: "next" };
    case "Enter":
      return typedNumber
        ? { kind: "goto", index: Math.max(0, Number(typedNumber) - 1) }
        : { kind: "next" };
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
    case "Backspace":
    case "p":
    case "P":
      return { kind: "prev" };
    case "Home":
      return { kind: "first" };
    case "End":
      return { kind: "last" };
    case "b":
    case "B":
    case ".":
      return { kind: "black" };
    case "w":
    case "W":
    case ",":
      return { kind: "white" };
    case "Escape":
      return "end";
    default:
      return null;
  }
}
