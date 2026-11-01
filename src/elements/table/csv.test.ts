import { describe, expect, it } from "vitest";
import { isNumeric, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses commas, quotes, escaped quotes and newlines inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n"multi\nline",3\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
      ["multi\nline", "3"],
    ]);
  });

  it("detects semicolons (Excel in Spanish) and tabs, and handles CRLF and BOM", () => {
    expect(parseCsv("﻿calibre;dB\r\n.22;94,5\r\n")).toEqual([
      ["calibre", "dB"],
      [".22", "94,5"],
    ]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps ragged rows and empty cells", () => {
    expect(parseCsv("a,,c\n1\n\n")).toEqual([["a", "", "c"], ["1"]]);
  });
});

describe("isNumeric", () => {
  it("recognizes numbers in several locales", () => {
    for (const v of ["12", "-3.5", "1,234.5", "1.234,5", "94,5", "45 %", "−2"])
      expect(isNumeric(v), v).toBe(true);
    for (const v of ["abc", "12a", "", ".22 LR"]) expect(isNumeric(v), v).toBe(false);
  });
});
