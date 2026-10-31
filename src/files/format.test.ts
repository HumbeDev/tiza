/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createPresentation, createShape } from "../document/factory";
import { FileError, packTiza, unpackTiza } from "./format";

const fixture = new Uint8Array(readFileSync(resolve("tests/fixtures/hello.tiza")));

const zipOf = (entries: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)])));

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof FileError ? e.code : "other";
  }
  return null;
};

describe(".tiza format (web)", () => {
  it("reads the file written by the Rust side", () => {
    const doc = unpackTiza(fixture);
    expect(doc.meta.title).toBe("Hola Tiza");
    expect(doc.slides).toHaveLength(2);
    expect(doc.slides[0].elements.map((e) => e.kind)).toEqual(["text", "math"]);
    expect(doc.latex.preamble).toContain("newcommand");
  });

  it("round-trips a presentation", () => {
    const doc = createPresentation("Test", "en");
    doc.slides[0].elements.push(createShape("ellipse", 100, 100));
    expect(unpackTiza(packTiza(doc, "0.1.0"))).toEqual(doc);
  });

  it("rejects other files", () => {
    expect(codeOf(() => unpackTiza(strToU8("hello")))).toBe("file.notTiza");
    expect(codeOf(() => unpackTiza(zipOf({ "a.txt": "x" })))).toBe("file.notTiza");
    const manifest = JSON.stringify({ format: "tiza", schemaVersion: 1, appVersion: "1" });
    expect(codeOf(() => unpackTiza(zipOf({ "manifest.json": manifest })))).toBe("file.notTiza");
    expect(
      codeOf(() => unpackTiza(zipOf({ "manifest.json": manifest, "presentation.json": "{" }))),
    ).toBe("file.invalid");
  });

  it("rejects newer formats and unsafe paths", () => {
    const newer = JSON.stringify({ format: "tiza", schemaVersion: 99, appVersion: "9" });
    expect(codeOf(() => unpackTiza(zipOf({ "manifest.json": newer })))).toBe("file.tooNew");
    expect(codeOf(() => unpackTiza(zipOf({ "../x": "" })))).toBe("file.unsafePath");
  });

  it("rejects documents without slides or with unknown elements", () => {
    const doc = createPresentation("Test", "en");
    const pack = (d: unknown) =>
      zipOf({
        "manifest.json": JSON.stringify({ format: "tiza", schemaVersion: 1, appVersion: "1" }),
        "presentation.json": JSON.stringify(d),
      });
    expect(codeOf(() => unpackTiza(pack({ ...doc, slides: [] })))).toBe("file.invalid");
    const bad = structuredClone(doc);
    (bad.slides[0].elements as unknown[]).push({ id: "x", kind: "hologram" });
    expect(codeOf(() => unpackTiza(pack(bad)))).toBe("file.invalid");
  });
});
