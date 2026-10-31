import { invoke } from "@tauri-apps/api/core";
import type { GpuReport } from "../bindings/GpuReport";
import { isDesktop } from "../files/platform";

export interface GpuInfo {
  webgl: boolean;
  webgl2: boolean;
  vendor: string | null;
  renderer: string | null;
  /** True when the browser draws without the GPU (software rasterizer). */
  software: boolean;
  /**
   * WebKit (Linux/macOS) hides the real GPU from pages and always says "Apple GPU".
   * Then neither the name nor the software check can be trusted.
   */
  masked: boolean;
}

/** What the web engine reports about the GPU it uses. */
export function gpuInfo(): GpuInfo {
  const canvas = document.createElement("canvas");
  const gl2 = canvas.getContext("webgl2");
  const gl = gl2 ?? canvas.getContext("webgl");
  if (!gl) {
    return {
      webgl: false,
      webgl2: false,
      vendor: null,
      renderer: null,
      software: true,
      masked: false,
    };
  }
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const vendor = String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR));
  const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return {
    webgl: true,
    webgl2: gl2 !== null,
    vendor,
    renderer,
    software: /llvmpipe|swiftshader|software|softpipe/i.test(renderer),
    masked: /^apple gpu$/i.test(renderer.trim()),
  };
}

/** Desktop only: the real graphics cards, asked to the operating system by Rust. */
export async function systemGpus(): Promise<GpuReport | null> {
  if (!isDesktop) return null;
  try {
    return await invoke<GpuReport>("system_gpus");
  } catch {
    return null;
  }
}

export const isLinux = (): boolean =>
  /Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent);

/** The GPU the web engine runs on, when it can be inferred (Linux: primary unless PRIME offload). */
export function gpuInUse(report: GpuReport | null) {
  if (!report || report.devices.length === 0 || !isLinux()) return null;
  const primary = report.devices.find((d) => d.primary) ?? report.devices[0];
  if (!report.offloadRequested) return primary;
  return report.devices.find((d) => !d.primary) ?? primary;
}

export function diagnosticsText(gpu: GpuInfo, system: GpuReport | null): string {
  return [
    `Tiza ${__APP_VERSION__} (${isDesktop ? "desktop" : "web"})`,
    `User agent: ${navigator.userAgent}`,
    ...(system?.devices ?? []).map(
      (d) =>
        `System GPU: ${d.vendor} — ${d.name}${d.driver ? ` (${d.driver})` : ""}${d.primary ? " [primary]" : ""}`,
    ),
    ...(system ? [`PRIME offload requested: ${system.offloadRequested ? "yes" : "no"}`] : []),
    `Web engine reports: ${gpu.vendor ?? "?"} — ${gpu.renderer ?? "?"}${gpu.masked ? " (masked)" : ""}`,
    `WebGL: ${gpu.webgl ? "yes" : "no"}, WebGL 2: ${gpu.webgl2 ? "yes" : "no"}`,
    `Screen: ${screen.width}×${screen.height} @${devicePixelRatio}x`,
  ].join("\n");
}
