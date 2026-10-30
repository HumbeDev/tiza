import { describe, expect, it } from "vitest";
import { pickLanguage } from "./languages";

describe("pickLanguage", () => {
  it("returns an exact supported tag", () => {
    expect(pickLanguage(["fr"])).toBe("fr");
    expect(pickLanguage(["pt-BR"])).toBe("pt-BR");
  });

  it("maps regional variants to their base language", () => {
    expect(pickLanguage(["es-AR"])).toBe("es");
    expect(pickLanguage(["en-GB"])).toBe("en");
    expect(pickLanguage(["fr-CA"])).toBe("fr");
  });

  it("maps every Portuguese variant to pt-BR", () => {
    expect(pickLanguage(["pt"])).toBe("pt-BR");
    expect(pickLanguage(["pt-PT"])).toBe("pt-BR");
  });

  it("respects preference order and skips unsupported languages", () => {
    expect(pickLanguage(["de-DE", "es-MX", "en"])).toBe("es");
  });

  it("falls back to English", () => {
    expect(pickLanguage(["ja"])).toBe("en");
    expect(pickLanguage([])).toBe("en");
  });
});
