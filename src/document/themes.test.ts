import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createPresentation, createShape, createSlide, createText } from "./factory";
import { THEMES, applyTheme, themedElement, themedSlide } from "./themes";

const byId = (id: string) => THEMES.find((t) => t.id === id)!;

describe("themes", () => {
  it("recolors only what uses the previous theme's colors", () => {
    let doc = createPresentation("t", "es");
    const text = createText("hola", 100, 100);
    const custom = { ...createText("rojo", 100, 300), color: "#ff0000" } as typeof text;
    const shape = createShape("rect", 500, 500);
    doc.slides[0].elements.push(text, custom, shape);
    doc = produce(doc, (d) => applyTheme(d, byId("night")));
    const [t, c, s] = doc.slides[0].elements;
    expect(doc.slides[0].background).toBe("#14213d");
    expect(t.kind === "text" && t.color).toBe("#e5e5e5");
    expect(c.kind === "text" && c.color).toBe("#ff0000");
    expect(s.kind === "shape" && s.fill).toBe("#fca311");
    expect(doc.theme?.id).toBe("night");

    // From one custom theme to another: night accent 0 → paper accent 0.
    doc = produce(doc, (d) => applyTheme(d, byId("paper")));
    expect(doc.slides[0].background).toBe("#fbf7ef");
    const s2 = doc.slides[0].elements[2];
    expect(s2.kind === "shape" && s2.fill).toBe("#8c2f39");
  });

  it("gives new elements and slides the theme's colors", () => {
    const doc = { theme: byId("chalkboard") };
    const t = themedElement(createText("x", 0, 0), doc);
    expect(t.kind === "text" && t.color).toBe("#f4f1e8");
    expect(themedSlide(createSlide(), doc).background).toBe("#24352d");
    expect(themedSlide(createSlide(), {}).background).toBe("#ffffff");
  });
});
