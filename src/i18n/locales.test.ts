import { describe, expect, it } from "vitest";
import { resources } from "./index";
import { SUPPORTED_LANGUAGES } from "./languages";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

const reference = flatten(resources.en.translation);

describe.each(SUPPORTED_LANGUAGES)("locale %s", (lang) => {
  const strings = flatten(resources[lang].translation);

  it("has exactly the same keys as English", () => {
    expect(Object.keys(strings).sort()).toEqual(Object.keys(reference).sort());
  });

  it("has no empty strings", () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("keeps the same {{placeholders}} as English", () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(placeholders(value), key).toEqual(placeholders(reference[key]));
    }
  });
});
