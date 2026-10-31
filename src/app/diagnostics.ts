import { isDesktop } from "../files/platform";

export interface GpuInfo {
  webgl: boolean;
  webgl2: boolean;
  vendor: string | null;
  renderer: string | null;
  /** True when the browser draws without the GPU (software rasterizer). */
  software: boolean;
}

/** What the web engine reports about the GPU it uses. */
export function gpuInfo(): GpuInfo {
  const canvas = document.createElement("canvas");
  const gl2 = canvas.getContext("webgl2");
  const gl = gl2 ?? canvas.getContext("webgl");
  if (!gl) return { webgl: false, webgl2: false, vendor: null, renderer: null, software: true };
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
  };
}

export function diagnosticsText(gpu: GpuInfo): string {
  return [
    `Tiza ${__APP_VERSION__} (${isDesktop ? "desktop" : "web"})`,
    `User agent: ${navigator.userAgent}`,
    `GPU: ${gpu.vendor ?? "?"} — ${gpu.renderer ?? "?"}`,
    `WebGL: ${gpu.webgl ? "yes" : "no"}, WebGL 2: ${gpu.webgl2 ? "yes" : "no"}`,
    `Screen: ${screen.width}×${screen.height} @${devicePixelRatio}x`,
  ].join("\n");
}
