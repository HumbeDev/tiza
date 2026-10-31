import { beforeEach, describe, expect, it } from "vitest";
import { createPresentation } from "../document/factory";
import { renderMath } from "../math/mathjax";
import {
  currentSlide,
  insertMath,
  loadDocument,
  setMathFontSize,
  setMathLatex,
  setPreamble,
  undo,
  useEditor,
} from "./editor";

const mathEl = () => {
  const el = currentSlide(useEditor.getState()).elements[0];
  if (el.kind !== "math") throw new Error("expected a math element");
  return el;
};

beforeEach(() => loadDocument(createPresentation("Test", "en")));

describe("equations", () => {
  it("inserts a formula sized to its rendering", async () => {
    await insertMath("x^2", 960, 540);
    const el = mathEl();
    const r = await renderMath("x^2", true);
    if (!r.ok) throw new Error(r.error);
    expect(el.w).toBeCloseTo(r.render.width * el.fontSize);
    expect(el.h).toBeCloseTo(r.render.height * el.fontSize);
    expect(el.x + el.w / 2).toBeCloseTo(960);
  });

  it("grows the box around its center when the formula gets longer", async () => {
    await insertMath("x", 960, 540);
    const before = mathEl();
    await renderMath("x + y + z", true);
    setMathLatex(before.id, "x + y + z", "edit");
    const after = mathEl();
    expect(after.w).toBeGreaterThan(before.w);
    expect(after.x + after.w / 2).toBeCloseTo(before.x + before.w / 2);
  });

  it("keeps invalid LaTeX as typed without changing the box", async () => {
    await insertMath("x", 960, 540);
    const before = mathEl();
    setMathLatex(before.id, String.raw`\frac{x`);
    expect(mathEl().latex).toBe(String.raw`\frac{x`);
    expect(mathEl().w).toBe(before.w);
  });

  it("scales the box with the font size", async () => {
    await insertMath("x^2", 960, 540);
    const before = mathEl();
    setMathFontSize(before.id, before.fontSize * 2);
    expect(mathEl().h).toBeCloseTo(before.h * 2);
  });

  it("undoes a whole editing session in one step", async () => {
    await insertMath("a", 960, 540);
    const id = mathEl().id;
    for (const latex of ["a+", "a+b", "a+b+c"]) setMathLatex(id, latex, `math:${id}`);
    undo();
    expect(mathEl().latex).toBe("a");
  });

  it("stores the preamble in the document and undoes it", () => {
    setPreamble(String.raw`\newcommand{\R}{\mathbb{R}}`);
    expect(useEditor.getState().doc.latex.preamble).toContain(String.raw`\R`);
    undo();
    expect(useEditor.getState().doc.latex.preamble).toBe("");
  });
});
