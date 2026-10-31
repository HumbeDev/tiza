import { describe, expect, it } from "vitest";
import { injectCsp, simCsp } from "./csp";

const META = /<meta http-equiv="Content-Security-Policy"/;

describe("injectCsp", () => {
  it("goes first inside an existing head", () => {
    const out = injectCsp(
      '<!DOCTYPE html><html><head lang="es"><title>x</title></head></html>',
      false,
    );
    expect(out.indexOf("<meta")).toBeGreaterThan(out.indexOf("<head"));
    expect(out.indexOf("<meta")).toBeLessThan(out.indexOf("<title>"));
  });

  it("creates a head after <html> or the doctype, keeping the doctype first", () => {
    expect(injectCsp("<html><body>x</body></html>", false)).toMatch(/^<html><head><meta/);
    expect(injectCsp("<!doctype html><body>x</body>", false)).toMatch(
      /^<!doctype html><head><meta/,
    );
  });

  it("wraps fragments", () => {
    const out = injectCsp("<canvas></canvas><script>1</script>", false);
    expect(out.startsWith("<!doctype html><head>")).toBe(true);
    expect(out).toMatch(META);
  });

  it("blocks the network unless allowed", () => {
    expect(simCsp(false)).not.toContain("https:");
    expect(simCsp(true)).toContain("connect-src https:");
  });
});
