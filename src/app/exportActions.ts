// File → Export actions: render, then ask where to save.
import { exportHtml, exportPdf, exportPng, useExportProgress } from "../export/export";
import { platform } from "../files/platform";
import { showFileError, untitled } from "../files/session";
import { useEditor } from "../store/editor";

export type ExportKind = "pdf" | "pdfSteps" | "png" | "pngCurrent" | "html";

/** File name for exports: the .tiza name without extension, or the title. */
export function exportBaseName(): string {
  const { file, doc } = useEditor.getState();
  const base = file.name?.replace(/\.tiza$/i, "") || doc.meta.title.trim();
  return base || untitled();
}

export async function runExport(kind: ExportKind): Promise<void> {
  if (useExportProgress.getState()) return; // one at a time
  const { doc, currentSlideId } = useEditor.getState();
  try {
    const result =
      kind === "pdf" || kind === "pdfSteps"
        ? await exportPdf(doc, kind === "pdfSteps")
        : kind === "html"
          ? await exportHtml(doc)
          : await exportPng(doc, kind === "pngCurrent" ? [currentSlideId] : undefined);
    await platform.saveExport(result.bytes, exportBaseName(), result.format);
  } catch (e) {
    await showFileError(e);
  }
}
