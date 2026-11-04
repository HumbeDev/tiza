// Draws slides into pictures (PDF/PNG export, `render_slide` for agents). Each slide is
// rendered off screen with the normal renderer in "export" mode, then rasterized.
import { domToCanvas } from "modern-screenshot";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { assetDataUrl, assetUrl } from "../assets/store";
import type { Presentation, Slide } from "../document";
import { buildSteps, visibleSlides } from "../present/client";
import SlideRenderer from "../render/SlideRenderer";

export interface Frame {
  slide: Slide;
  /** Visible slide number (1-based). */
  number: number;
  /** Build step shown; undefined = everything (final state). */
  step?: number;
}

/** The pictures an export contains: one per visible slide, or one per build step. */
export function exportFrames(doc: Presentation, everyStep: boolean): Frame[] {
  const steps = buildSteps(doc);
  return visibleSlides(doc).flatMap((slide, i) => {
    if (!everyStep || steps[i] === 0) return [{ slide, number: i + 1 }];
    return Array.from({ length: steps[i] + 1 }, (_, step) => ({ slide, number: i + 1, step }));
  });
}

/** Resolves once the DOM under `node` has stopped changing (math, fonts, images). */
function settle(node: HTMLElement, quietMs = 120, maxMs = 6000): Promise<void> {
  return new Promise((resolve) => {
    let timer = setTimeout(done, quietMs);
    const cap = setTimeout(done, maxMs);
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, quietMs);
    });
    observer.observe(node, { subtree: true, childList: true, attributes: true });
    function done() {
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(cap);
      resolve();
    }
  });
}

/** Rasterizes one frame at `scale` × the page size (1 = 1920×1080 for 16:9). */
export async function renderFrame(
  doc: Presentation,
  frame: Pick<Frame, "slide" | "step">,
  scale: number,
): Promise<HTMLCanvasElement> {
  const { page } = doc;
  const host = document.createElement("div");
  host.className = "export-host";
  host.style.cssText = `position:fixed;left:-${page.width * 2}px;top:0;width:${page.width}px;height:${page.height}px;pointer-events:none;`;
  document.body.append(host);
  const root = createRoot(host);
  try {
    root.render(
      createElement(SlideRenderer, {
        slide: frame.slide,
        page,
        mode: "export",
        step: frame.step,
        master: doc.master,
        font: doc.theme?.font,
      }),
    );
    await settle(host);
    await document.fonts?.ready;
    const node = host.firstElementChild as HTMLElement;

    // Slide pictures are read directly (custom protocols and blob: URLs can't be fetched).
    const assets = new Map<string, string>();
    for (const el of frame.slide.elements)
      if (el.kind === "image") assets.set(assetUrl(el.asset), el.asset);

    return await domToCanvas(node, {
      width: page.width,
      height: page.height,
      scale,
      backgroundColor: frame.slide.background ?? "#ffffff",
      timeout: 10_000,
      font: false,
      fetchFn: async (url) => {
        const name = assets.get(url);
        return name ? assetDataUrl(name) : false;
      },
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

export function canvasToBytes(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg") {
  return new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject)
          : reject(new Error("toBlob")),
      type,
      0.92,
    ),
  );
}
