import type { Element, Presentation, ShapeKind, Slide } from ".";
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
    text,
    fontSize: 64,
    color: "#1d1d1b",
    align: "left",
    bold: false,
    italic: false,
  };
}
