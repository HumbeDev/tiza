import { afterEach, describe, expect, it, vi } from "vitest";
import type { GpuReport } from "../bindings/GpuReport";
import { gpuInUse } from "./diagnostics";

const intel = {
  name: "TigerLake-H GT1 [UHD Graphics]",
  vendor: "Intel",
  driver: "i915",
  primary: true,
};
const nvidia = {
  name: "GA107M [GeForce RTX 3050 Ti Mobile]",
  vendor: "NVIDIA",
  driver: "nvidia",
  primary: false,
};
const report = (offloadRequested: boolean): GpuReport => ({
  devices: [intel, nvidia],
  offloadRequested,
});

describe("gpuInUse", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is the primary GPU on Linux unless PRIME offload was requested", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit" });
    expect(gpuInUse(report(false))).toBe(intel);
    expect(gpuInUse(report(true))).toBe(nvidia);
  });

  it("is unknown elsewhere or without a report", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/140" });
    expect(gpuInUse(report(false))).toBeNull();
    expect(gpuInUse(null)).toBeNull();
  });
});
