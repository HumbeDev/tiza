/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createImage, createPresentation, createShape } from "../document/factory";
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
    const { doc } = unpackTiza(fixture);
    expect(doc.meta.title).toBe("Hola Tiza");
    expect(doc.slides).toHaveLength(2);
    expect(doc.slides[0].elements.map((e) => e.kind)).toEqual(["text", "math"]);
    expect(doc.latex.preamble).toContain("newcommand");
  });

  it("round-trips a presentation", () => {
    const doc = createPresentation("Test", "en");
    doc.slides[0].elements.push(createShape("ellipse", 100, 100));
    expect(unpackTiza(packTiza(doc, "0.1.0")).doc).toEqual(doc);
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

describe("assets in .tiza (web)", () => {
  it("packs only referenced pictures and reads them back", () => {
    const name = `sha256-${"a".repeat(64)}.png`;
    const unused = `sha256-${"b".repeat(64)}.png`;
    const doc = createPresentation("Test", "en");
    doc.slides[0].elements.push(createImage(name, { width: 10, height: 10 }, 50, 50));
    const bytes = packTiza(doc, "0.1.0", {
      [name]: new Uint8Array([1, 2, 3]),
      [unused]: new Uint8Array([9]),
    });
    const back = unpackTiza(bytes);
    expect(back.doc).toEqual(doc);
    expect(Object.keys(back.assets)).toEqual([name]);
    expect([...back.assets[name]]).toEqual([1, 2, 3]);
  });

  it("rejects unexpected names in the assets folder", () => {
    const manifest = JSON.stringify({ format: "tiza", schemaVersion: 1, appVersion: "1" });
    const doc = JSON.stringify(createPresentation("x", "en"));
    expect(
      codeOf(() =>
        unpackTiza(
          zipOf({ "manifest.json": manifest, "presentation.json": doc, "assets/evil.sh": "x" }),
        ),
      ),
    ).toBe("file.unsafePath");
  });
});
