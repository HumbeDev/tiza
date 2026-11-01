import { describe, expect, it } from "vitest";
import { type TextRun, groupText } from "./pdf";

const run = (
  text: string,
  x: number,
  y: number,
  width: number,
  size = 20,
  bold = false,
): TextRun => ({
  text,
  x,
  y,
  width,
  size,
  bold,
  italic: false,
});

describe("groupText", () => {
  it("joins runs on the same baseline into a line, adding spaces between words", () => {
    const [block] = groupText([run("Hola", 100, 100, 40), run("mundo", 148, 101, 52)]);
    expect(block.lines.map((l) => l.text)).toEqual(["Hola mundo"]);
  });

  it("does not add spaces inside a word split into runs", () => {
    const [block] = groupText([run("Física", 100, 100, 60), run("s", 160, 100, 8)]);
    expect(block.lines[0].text).toBe("Físicas");
  });

  it("groups consecutive lines of a paragraph and separates distant blocks", () => {
    const blocks = groupText([
      run("Título grande", 100, 50, 300, 48, true),
      run("Primera línea del párrafo", 100, 200, 400),
      run("segunda línea", 100, 226, 200),
      run("Otra columna", 1100, 200, 200),
      run("Pie de página", 100, 1000, 200),
    ]);
    expect(blocks.map((b) => b.lines.map((l) => l.text))).toEqual([
      ["Título grande"],
      ["Primera línea del párrafo", "segunda línea"],
      ["Otra columna"],
      ["Pie de página"],
    ]);
    expect(blocks[0]).toMatchObject({ bold: true, size: 48 });
    expect(blocks[1].height).toBeCloseTo(46);
  });

  it("ignores empty runs", () => {
    expect(groupText([run("   ", 0, 0, 10)])).toEqual([]);
  });
});
