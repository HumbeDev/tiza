// MathJax 4 configured for offline use: everything is bundled, font data that MathJax loads
// on demand comes from lazily-imported chunks instead of the network.
import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/js/input/tex/cases/CasesConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js";
import "@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js";
import "@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js";
import "@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";

const PACKAGES = [
  "base",
  "ams",
  "newcommand",
  "boldsymbol",
  "braket",
  "cancel",
  "cases",
  "color",
  "enclose",
  "gensymb",
  "mathtools",
  "mhchem",
  "physics",
  "textmacros",
];

const fontChunks = import.meta.glob(
  "../../node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js",
);
const fontLoaders = new Map(
  Object.entries(fontChunks).map(([path, load]) => [path.split("/").pop()!, load]),
);

mathjax.asyncLoad = (name: string) => {
  const load = fontLoaders.get(name.split("/").pop()!);
  return load ? load() : Promise.reject(new Error(`MathJax: unknown module ${name}`));
};

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

export interface MathRender {
  /** Standalone SVG markup without width/height; size it with the fields below. */
  svg: string;
  /** Size in em. */
  width: number;
  height: number;
  /** Distance from the baseline to the bottom, in em (for inline alignment). */
  depth: number;
}

export type MathResult = { ok: true; render: MathRender } | { ok: false; error: string };

type DocType = ReturnType<typeof mathjax.document>;

let doc: DocType;
let preambleError: string | null = null;
let currentPreamble = "";
let version = 0;
const listeners = new Set<() => void>();
const cache = new Map<string, MathResult>();
const pending = new Map<string, Promise<MathResult>>();

function createDocument(preamble: string): void {
  const tex = new TeX({
    packages: PACKAGES,
    formatError: (_jax: unknown, err: Error) => {
      throw err;
    },
  });
  const svg = new SVG({
    fontCache: "none",
    fontData: MathJaxNewcmFont,
    // One SVG per formula: inline math is never split across lines.
    linebreaks: { inline: false },
  });
  doc = mathjax.document("", { InputJax: tex, OutputJax: svg });
  preambleError = null;
  if (preamble.trim()) {
    try {
      doc.convert(preamble, { display: false });
    } catch (e) {
      if (isRetry(e)) {
        // Fonts aren't needed for macro definitions; retry quietly once they arrive.
        void mathjax.handleRetriesFor(() => doc.convert(preamble, { display: false }));
      } else preambleError = message(e);
    }
  }
}

createDocument("");

function notify() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getVersion = (): number => version;

/** Global `\newcommand` definitions applied to every formula. */
export function setPreamble(preamble: string): void {
  if (preamble === currentPreamble) return;
  currentPreamble = preamble;
  cache.clear();
  createDocument(preamble);
  notify();
}

export const getPreambleError = (): string | null => preambleError;

const isRetry = (e: unknown): boolean =>
  typeof e === "object" &&
  e !== null &&
  "retry" in e &&
  (e as { retry: unknown }).retry instanceof Promise;

// MathJax's TexError is not an `Error` subclass, but it has a `message`.
const message = (e: unknown): string =>
  typeof e === "object" && e !== null && "message" in e ? String(e.message) : String(e);

function convert(latex: string, display: boolean): MathRender {
  const node = doc.convert(latex, { display, em: 16, ex: 8, containerWidth: 1e6 });
  const svgNode = adaptor.firstChild(node) as Parameters<typeof adaptor.getAttribute>[0];
  const [, minY, w, h] = (adaptor.getAttribute(svgNode, "viewBox") ?? "0 0 0 0")
    .split(/\s+/)
    .map(Number);
  for (const attr of ["width", "height", "style", "role", "focusable", "aria-hidden"]) {
    adaptor.removeAttribute(svgNode, attr);
  }
  const svg = stripLinks(adaptor.serializeXML(svgNode));
  return { svg, width: w / 1000, height: h / 1000, depth: (h + minY) / 1000 };
}

/** Formulas never navigate anywhere: drop any link that `\href` could create. */
const stripLinks = (svg: string): string => svg.replace(/\s(?:xlink:)?href="(?!#)[^"]*"/g, "");

const key = (latex: string, display: boolean) => `${display ? "D" : "I"}${latex}`;

/**
 * Renders synchronously when possible. Returns `null` while font data is still loading;
 * subscribers are notified when it is ready.
 */
export function renderMathSync(latex: string, display: boolean): MathResult | null {
  const k = key(latex, display);
  const cached = cache.get(k);
  if (cached) return cached;
  try {
    const result: MathResult = { ok: true, render: convert(latex, display) };
    cache.set(k, result);
    return result;
  } catch (e) {
    if (!isRetry(e)) {
      const result: MathResult = { ok: false, error: message(e) };
      cache.set(k, result);
      return result;
    }
    void renderMath(latex, display).then(notify);
    return null;
  }
}

/** Renders, waiting for any font data the formula needs. */
export function renderMath(latex: string, display: boolean): Promise<MathResult> {
  const k = key(latex, display);
  const cached = cache.get(k);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(k);
  if (!p) {
    p = mathjax
      .handleRetriesFor(() => convert(latex, display))
      .then(
        (render): MathResult => ({ ok: true, render }),
        (e): MathResult => ({ ok: false, error: message(e) }),
      )
      .then((result) => {
        cache.set(k, result);
        pending.delete(k);
        return result;
      });
    pending.set(k, p);
  }
  return p;
}
