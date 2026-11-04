// Built-in designs (Design tab). A theme sets the presentation's background, text color,
// accent colors and font. Applying one recolors only what still uses the previous
// theme's colors, so colors the user picked by hand stay.
import type { Element, Presentation, Slide, Theme } from ".";

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
const SERIF = 'Georgia, "Noto Serif", "DejaVu Serif", "Times New Roman", serif';
const BOOK = 'Palatino, "Palatino Linotype", "Book Antiqua", "URW Palladio L", serif';
const ROUND = '"Trebuchet MS", "Nunito", "Ubuntu", "Noto Sans", sans-serif';

export const THEMES: Theme[] = [
  {
    id: "tiza",
    font: SANS,
    background: "#ffffff",
    text: "#1d1d1b",
    accents: ["#4f8a6b", "#e07a5f", "#3d5a80", "#f2cc8f"],
  },
  {
    id: "chalkboard",
    font: ROUND,
    background: "#24352d",
    text: "#f4f1e8",
    accents: ["#f2cc8f", "#a8dadc", "#f4a261", "#e9c46a"],
  },
  {
    id: "night",
    font: SANS,
    background: "#14213d",
    text: "#e5e5e5",
    accents: ["#fca311", "#5fa8d3", "#e76f51", "#90be6d"],
  },
  {
    id: "paper",
    font: SERIF,
    background: "#fbf7ef",
    text: "#2b2622",
    accents: ["#8c2f39", "#386641", "#bc6c25", "#3a5a40"],
  },
  {
    id: "ocean",
    font: SANS,
    background: "#f0f6fa",
    text: "#12324a",
    accents: ["#1d70a2", "#2a9d8f", "#e76f51", "#264653"],
  },
  {
    id: "gray",
    font: SANS,
    background: "#f5f5f5",
    text: "#222222",
    accents: ["#555555", "#d62828", "#457b9d", "#2a9d8f"],
  },
  {
    id: "academic",
    font: BOOK,
    background: "#ffffff",
    text: "#10213d",
    accents: ["#002855", "#a6192e", "#0072ce", "#7a7a7a"],
  },
  {
    id: "contrast",
    font: SANS,
    background: "#000000",
    text: "#ffffff",
    accents: ["#ffd60a", "#00b4d8", "#ff006e", "#80ed99"],
  },
];

/** The design in use: the document's, or Tiza's default. */
export const themeOf = (doc: Pick<Presentation, "theme">): Theme => doc.theme ?? THEMES[0];

const same = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** `color` translated from `from` to `to` (text → text, accent i → accent i), or null. */
function translate(color: string | undefined, from: Theme, to: Theme): string | null {
  if (same(color, from.text)) return to.text;
  if (same(color, from.background)) return to.background;
  const i = from.accents.findIndex((a) => same(a, color));
  return i >= 0 ? (to.accents[i] ?? to.accents[0]) : null;
}

function recolor(el: Element, from: Theme, to: Theme): void {
  if ("color" in el && typeof el.color === "string")
    el.color = translate(el.color, from, to) ?? el.color;
  if (el.kind === "shape") {
    if (el.fill) el.fill = translate(el.fill, from, to) ?? el.fill;
    if (el.stroke) el.stroke.color = translate(el.stroke.color, from, to) ?? el.stroke.color;
  }
}

function recolorSlide(slide: Slide, from: Theme, to: Theme): void {
  if (slide.background === undefined || same(slide.background, from.background))
    slide.background = to.background;
  for (const el of slide.elements) recolor(el, from, to);
}

/** Applies `theme` to a (draft) document. */
export function applyTheme(doc: Presentation, theme: Theme): void {
  const from = themeOf(doc);
  for (const slide of doc.slides) recolorSlide(slide, from, theme);
  if (doc.template) recolorSlide(doc.template, from, theme);
  // The master has no background of its own: only its elements change.
  if (doc.master) for (const el of doc.master.elements) recolor(el, from, theme);
  doc.theme = structuredClone(theme);
}

/** New elements and slides take the design's colors instead of Tiza's defaults. */
export function themedElement(el: Element, doc: Pick<Presentation, "theme">): Element {
  if (!doc.theme) return el;
  const copy = structuredClone(el);
  recolor(copy, THEMES[0], doc.theme);
  return copy;
}

export function themedSlide(slide: Slide, doc: Pick<Presentation, "theme">): Slide {
  if (!doc.theme || !same(slide.background, THEMES[0].background)) return slide;
  return { ...slide, background: doc.theme.background };
}
