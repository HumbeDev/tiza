import { describe, expect, it } from "vitest";
import { makePdf } from "./pdf";

const text = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);
const fakeJpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);

describe("makePdf", () => {
  it("writes one page per picture with a valid cross-reference table", () => {
    const pdf = makePdf(
      [
        { jpeg: fakeJpeg, width: 1920, height: 1080 },
        { jpeg: fakeJpeg, width: 1920, height: 1080 },
      ],
      { pageWidth: 960, pageHeight: 540, title: "Física — clase 1" },
    );
    const s = text(pdf);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("/Count 2");
    expect(s).toContain("/MediaBox [0 0 960.00 540.00]");
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(2);

    // Every xref offset points at the start of its object.
    const xrefAt = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = s
      .slice(xrefAt)
      .split("\n")
      .slice(3, 3 + 9);
    entries.forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(s.slice(offset, offset + 8)).toBe(`${i + 1} 0 obj`.padEnd(8, "\n").slice(0, 8));
    });
  });

  it("stores the title as UTF-16 so accents survive", () => {
    const s = text(makePdf([], { pageWidth: 1, pageHeight: 1, title: "é" }));
    expect(s).toContain("/Title <FEFF00e9>");
  });
});
