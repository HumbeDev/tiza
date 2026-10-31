import { describe, expect, it } from "vitest";
import { getPreambleError, renderMath, setPreamble } from "./mathjax";

describe("renderMath", () => {
  it("renders a formula to SVG with a size in em", async () => {
    const r = await renderMath("E = mc^2", false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.render.svg.startsWith("<svg")).toBe(true);
    expect(r.render.svg).not.toMatch(/\swidth=/);
    expect(r.render.svg.match(/<svg/g)).toHaveLength(1);
    expect(r.render.width).toBeGreaterThan(2);
    expect(r.render.height).toBeGreaterThan(0.5);
  });

  it("supports ams, physics and mhchem", async () => {
    for (const tex of [
      String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`,
      String.raw`\dv{f}{x} = \grad\phi`,
      String.raw`\ce{H2O ->[\Delta] H2 + O2}`,
      String.raw`\mathbb{R}^n \to \mathfrak{g}`,
    ]) {
      const r = await renderMath(tex, true);
      expect(r.ok, tex).toBe(true);
    }
  });

  it("reports TeX errors instead of drawing them", async () => {
    const r = await renderMath(String.raw`\frac{1}{`, true);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/[Mm]issing/);
    const u = await renderMath(String.raw`\notacommand`, true);
    expect(u.ok).toBe(false);
  });

  it("applies preamble macros and forgets them when the preamble changes", async () => {
    setPreamble(String.raw`\newcommand{\R}{\mathbb{R}}`);
    expect(getPreambleError()).toBeNull();
    expect((await renderMath(String.raw`x \in \R`, false)).ok).toBe(true);
    setPreamble("");
    expect((await renderMath(String.raw`x \in \R`, false)).ok).toBe(false);
  });

  it("removes links created by \\href", async () => {
    const r = await renderMath(String.raw`\href{javascript:alert(1)}{x}`, false);
    expect(r.ok && r.render.svg.includes("javascript:")).toBe(false);
  });
});
