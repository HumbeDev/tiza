import type { Element, Presentation, ShapeKind, Slide } from ".";
import { plainDoc } from "./richtext";
import { SCHEMA_VERSION } from ".";

export const newId = (): string => crypto.randomUUID();

export function createSlide(): Slide {
  return { id: newId(), background: "#ffffff", elements: [], notes: "", hidden: false };
}

export function createPresentation(title: string, lang: string): Presentation {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { title, created: now, modified: now, lang },
    page: { aspect: "16:9", width: 1920, height: 1080 },
    latex: { preamble: "" },
    slides: [createSlide()],
  };
}

const base = { rotation: 0, opacity: 1, locked: false };

export function createShape(shape: ShapeKind, cx: number, cy: number): Element {
  const isLine = shape === "line" || shape === "arrow";
  const w = isLine ? 400 : 320;
  const h = isLine ? 40 : 220;
  return {
    ...base,
    id: newId(),
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    kind: "shape",
    shape,
    fill: isLine ? undefined : "#4f8a6b",
    stroke: isLine ? { color: "#1d1d1b", width: 6 } : undefined,
    radius: 0,
  };
}

export function createText(text: string, cx: number, cy: number): Element {
  const w = 800;
  const h = 120;
  return {
    ...base,
    id: newId(),
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    kind: "text",
    doc: plainDoc(text),
    fontSize: 64,
    color: "#1d1d1b",
    align: "left",
  };
}

export const DEFAULT_MATH_SIZE = 80;

/** A formula centered at (cx, cy); `size` is its rendered size in em. */
export function createMath(
  latex: string,
  cx: number,
  cy: number,
  size: { width: number; height: number },
  fontSize = DEFAULT_MATH_SIZE,
): Element {
  const w = Math.max(1, size.width * fontSize);
  const h = Math.max(1, size.height * fontSize);
  return {
    ...base,
    id: newId(),
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    kind: "math",
    latex,
    fontSize,
    color: "#1d1d1b",
    align: "center",
  };
}

/** An HTML page box centered at (cx, cy), 1:1 with its internal resolution. */
export function createSim(html: string, title: string, cx: number, cy: number): Element {
  const viewWidth = 1120;
  const viewHeight = 630;
  return {
    ...base,
    id: newId(),
    x: cx - viewWidth / 2,
    y: cy - viewHeight / 2,
    w: viewWidth,
    h: viewHeight,
    kind: "sim",
    html,
    title,
    viewWidth,
    viewHeight,
    fit: "contain",
    allowNetwork: false,
  };
}

/**
 * A picture centered at (cx, cy), at its natural size but at most `maxW × maxH`
 * (logical units), keeping its proportions.
 */
export function createImage(
  asset: string,
  natural: { width?: number; height?: number },
  cx: number,
  cy: number,
  maxW = 1280,
  maxH = 720,
): Element {
  const nw = natural.width || 800;
  const nh = natural.height || 600;
  const s = Math.min(1, maxW / nw, maxH / nh);
  const w = nw * s;
  const h = nh * s;
  return {
    ...base,
    id: newId(),
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    kind: "image",
    asset,
    fit: "contain",
  };
}
