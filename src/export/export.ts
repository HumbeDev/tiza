// Export commands: PDF (one page per slide or per build step), PNG pictures and a
// self-contained HTML presentation. Used by the File menu and the MCP tools.
import { zipSync } from "fflate";
import type { Presentation } from "../document";
import { canvasToBytes, exportFrames, renderFrame } from "./capture";
import { exportHtml } from "./html";
import { makePdf } from "./pdf";
import { type ExportResult, withProgress } from "./progress";

export { useExportProgress, type ExportResult } from "./progress";

/** PDF with each visible slide as a page (16:9 → 13.33 × 7.5 in, like PowerPoint). */
export function exportPdf(doc: Presentation, everyStep: boolean): Promise<ExportResult> {
  const frames = exportFrames(doc, everyStep);
  return withProgress(frames.length, async (tick) => {
    const pages = [];
    for (const frame of frames) {
      const canvas = await renderFrame(doc, frame, 1.5);
      pages.push({
        jpeg: await canvasToBytes(canvas, "image/jpeg"),
        width: canvas.width,
        height: canvas.height,
      });
      tick();
    }
    const bytes = makePdf(pages, {
      pageWidth: (doc.page.width / doc.page.height) * 540,
      pageHeight: 540,
      title: doc.meta.title,
    });
    return { bytes, format: "pdf" };
  });
}

/**
 * PNG pictures at the page's size (1920×1080 for 16:9). One slide → a .png; several →
 * a .zip with `01.png`, `02.png`…
 */
export function exportPng(doc: Presentation, slideIds?: string[]): Promise<ExportResult> {
  const frames = exportFrames(doc, false).filter((f) => !slideIds || slideIds.includes(f.slide.id));
  return withProgress(frames.length, async (tick) => {
    const files: Record<string, Uint8Array> = {};
    const width = String(frames.at(-1)?.number ?? 1).length;
    for (const frame of frames) {
      const png = await canvasToBytes(await renderFrame(doc, frame, 1), "image/png");
      files[`${String(frame.number).padStart(Math.max(2, width), "0")}.png`] = png;
      tick();
    }
    const names = Object.keys(files);
    if (names.length === 1) return { bytes: files[names[0]], format: "png" as const };
    return { bytes: zipSync(files, { level: 0 }), format: "zip" as const };
  });
}

export { exportHtml };
