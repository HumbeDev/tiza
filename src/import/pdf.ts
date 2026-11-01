// PDF → Tiza slides. Each page becomes a slide: the page drawn without its text is the
// background (figures, charts, colors stay exact) and the text goes on top as editable
// text boxes, grouped into lines and paragraphs, with its color sampled from the page.
import type { Element, Presentation, Slide } from "../document";
import { SCHEMA_VERSION } from "../document";
import { newId } from "../document/factory";
import { plainDoc } from "../document/richtext";
import type { PutAsset } from "./pptx";

/** A run of text in slide units: (x, y) is the top-left, `size` the font size. */
export interface TextRun {
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  bold: boolean;
  italic: boolean;
}

export interface TextBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  bold: boolean;
  italic: boolean;
  lines: { text: string; x: number; y: number; width: number }[];
}

/**
 * Groups runs into lines (same baseline, close together) and lines into blocks (aligned
 * left edges or overlapping, similar size, small vertical gap).
 */
export function groupText(runs: TextRun[]): TextBlock[] {
  const sorted = [...runs].filter((r) => r.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);

  // Lines.
  const lines: { runs: TextRun[]; x: number; y: number; right: number; size: number }[] = [];
  for (const run of sorted) {
    const line = lines.find(
      (l) =>
        Math.abs(l.y - run.y) < l.size * 0.35 &&
        Math.abs(l.size - run.size) < l.size * 0.25 &&
        run.x - l.right < l.size * 1.5 &&
        run.x + run.width > l.x - l.size,
    );
    if (line) {
      line.runs.push(run);
      line.x = Math.min(line.x, run.x);
      line.right = Math.max(line.right, run.x + run.width);
    } else {
      lines.push({ runs: [run], x: run.x, y: run.y, right: run.x + run.width, size: run.size });
    }
  }

  const lineText = (rs: TextRun[]) => {
    const ordered = [...rs].sort((a, b) => a.x - b.x);
    let text = "";
    let end = -Infinity;
    for (const r of ordered) {
      if (text && r.x - end > r.size * 0.15 && !text.endsWith(" ") && !r.text.startsWith(" "))
        text += " ";
      text += r.text;
      end = r.x + r.width;
    }
    return text.replace(/\s+/g, " ").trim();
  };

  // Blocks: each line joins the block whose last line sits right above it (columns stay
  // separate because each keeps its own open block).
  const blocks: TextBlock[] = [];
  for (const line of lines.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const bold = line.runs.every((r) => r.bold);
    const italic = line.runs.every((r) => r.italic);
    const entry = { text: lineText(line.runs), x: line.x, y: line.y, width: line.right - line.x };
    const block = blocks.find((b) => {
      const last = b.lines[b.lines.length - 1];
      return (
        Math.abs(b.size - line.size) < b.size * 0.2 &&
        b.bold === bold &&
        line.y > last.y &&
        line.y - (last.y + b.size) < b.size * 0.9 &&
        (Math.abs(line.x - b.x) < b.size * 1.2 || (line.x < b.x + b.width && line.right > b.x))
      );
    });
    if (block) {
      block.lines.push(entry);
      const right = Math.max(block.x + block.width, line.right);
      block.x = Math.min(block.x, line.x);
      block.width = right - block.x;
      block.height = line.y + line.size - block.y;
    } else {
      blocks.push({
        x: line.x,
        y: line.y,
        width: line.right - line.x,
        height: line.size,
        size: line.runs[0].size,
        bold,
        italic,
        lines: [entry],
      });
    }
  }
  return blocks;
}

const BASE = "/vendor/pdfjs/";

export async function importPdf(
  bytes: Uint8Array,
  options: {
    lang: string;
    title?: string;
    putAsset: PutAsset;
    onProgress?: (page: number, total: number) => void;
  },
): Promise<{ doc: Presentation; skipped: Record<string, number> }> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const base = new URL(BASE, location.href).href;
  const task = pdfjs.getDocument({
    data: bytes,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
  });
  const pdf = await task.promise;

  const first = await pdf.getPage(1);
  const firstView = first.getViewport({ scale: 1 });
  const width = 1920;
  const height = Math.round((width * firstView.height) / firstView.width);
  const fourThree = Math.abs(firstView.width / firstView.height - 4 / 3) < 0.05;

  const slides: Slide[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    options.onProgress?.(n, pdf.numPages);
    const page = n === 1 ? first : await pdf.getPage(n);
    slides.push(await importPage(pdfjs, page, width, options.putAsset));
    page.cleanup();
  }
  const meta = await pdf.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as { Title?: string };
  await task.destroy();

  const now = new Date().toISOString();
  return {
    doc: {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        title: info.Title?.trim() || options.title || "",
        created: now,
        modified: now,
        lang: options.lang,
      },
      page: { aspect: fourThree ? "4:3" : "16:9", width, height },
      latex: { preamble: "" },
      slides,
    },
    skipped: {},
  };
}

type PdfJs = typeof import("pdfjs-dist");
type PdfPage = Awaited<ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>>;

/** Pixel scale of the background image relative to slide units (sharper when zoomed). */
const RASTER = 1.5;

async function importPage(
  pdfjs: PdfJs,
  page: PdfPage,
  width: number,
  putAsset: PutAsset,
): Promise<Slide> {
  const view = page.getViewport({ scale: 1 });
  const scale = width / view.width;
  const viewport = page.getViewport({ scale: scale * RASTER });

  const render = async (withText: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    if (!withText) {
      // The text is re-created as editable boxes: don't paint it into the background.
      ctx.fillText = () => {};
      ctx.strokeText = () => {};
    }
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    return { canvas, ctx };
  };

  const background = await render(false);
  const withText = await render(true);
  const blob = await new Promise<Blob | null>((r) => background.canvas.toBlob(r, "image/png"));
  const elements: Element[] = [];
  if (blob) {
    const asset = await putAsset(new Uint8Array(await blob.arrayBuffer()), "png");
    elements.push({
      id: newId(),
      x: 0,
      y: 0,
      w: width,
      h: (view.height * width) / view.width,
      rotation: 0,
      opacity: 1,
      locked: true,
      kind: "image",
      asset,
      fit: "fill",
    } as Element);
  }

  // Text runs in slide units.
  const content = await page.getTextContent();
  const textViewport = page.getViewport({ scale });
  const runs: TextRun[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str) continue;
    const tx = pdfjs.Util.transform(textViewport.transform, item.transform);
    const size = Math.hypot(tx[2], tx[3]);
    if (size < 1) continue;
    const fontName = fontNameOf(page, item.fontName);
    runs.push({
      text: item.str,
      x: tx[4],
      y: tx[5] - size,
      width: item.width * scale,
      size,
      bold: /bold|black|heavy|semibold|demi/i.test(fontName),
      italic: /italic|oblique/i.test(fontName),
    });
  }

  for (const block of groupText(runs)) {
    const color = sampleTextColor(background.ctx, withText.ctx, block, RASTER);
    elements.push({
      id: newId(),
      x: block.x,
      y: block.y - block.size * 0.12,
      // Tiza's font is not the PDF's: leave room so lines don't wrap differently.
      w: block.width * 1.12 + block.size,
      h: block.height + block.size * 0.4,
      rotation: 0,
      opacity: 1,
      locked: false,
      kind: "text",
      doc: markDoc(block),
      fontSize: Math.round(block.size * 10) / 10,
      color,
      align: "left",
    } as Element);
  }
  return { id: newId(), background: "#ffffff", elements, notes: "", hidden: false };
}

function markDoc(block: TextBlock) {
  const doc = plainDoc(block.lines.map((l) => l.text).join("\n"));
  const marks = [
    ...(block.bold ? [{ type: "bold" }] : []),
    ...(block.italic ? [{ type: "italic" }] : []),
  ];
  if (marks.length)
    for (const p of doc.content ?? []) for (const t of p.content ?? []) t.marks = marks;
  return doc;
}

function fontNameOf(page: PdfPage, id: string): string {
  try {
    const font = page.commonObjs.get(id) as { name?: string } | undefined;
    return font?.name ?? "";
  } catch {
    return "";
  }
}

/** Average color of the pixels that the text changed (page with text vs. without). */
function sampleTextColor(
  bg: CanvasRenderingContext2D,
  text: CanvasRenderingContext2D,
  block: TextBlock,
  k: number,
): string {
  const x = Math.max(0, Math.floor(block.x * k));
  const y = Math.max(0, Math.floor(block.y * k));
  const w = Math.max(1, Math.min(Math.ceil(block.width * k), bg.canvas.width - x));
  const h = Math.max(1, Math.min(Math.ceil(block.height * k), bg.canvas.height - y));
  const a = bg.getImageData(x, y, w, h).data;
  const b = text.getImageData(x, y, w, h).data;
  let r = 0;
  let g = 0;
  let bl = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 8) {
    const diff =
      Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (diff < 90) continue;
    // Weight by how much the text changed the pixel: glyph cores beat antialiased edges.
    const weight = diff * diff;
    r += b[i] * weight;
    g += b[i + 1] * weight;
    bl += b[i + 2] * weight;
    n += weight;
  }
  if (!n) return "#000000";
  const hex = (v: number) =>
    Math.round(v / n)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}
