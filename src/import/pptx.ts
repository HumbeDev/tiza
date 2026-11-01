// PowerPoint (.pptx, Office Open XML) → Tiza document with editable elements.
// Runs in the browser and in the desktop app alike (no external software).
//
// What is converted: slide size, text boxes and placeholders (inheriting position, size,
// color, alignment and bullets from the layout and master), runs (bold, italic, underline,
// strike), pictures, basic shapes and lines with their colors, backgrounds, hidden slides,
// speaker notes, and the decorations of layouts/masters (logos, bars…).
// Not yet: tables, charts, SmartArt, equations (OMML), video. They are counted as skipped.
import { strFromU8, unzipSync } from "fflate";
import type { Element, Presentation, RichNode, ShapeKind, Slide, TextAlign } from "../document";
import { SCHEMA_VERSION } from "../document";
import { newId } from "../document/factory";

export interface ImportResult {
  doc: Presentation;
  /** Things that could not be converted, by kind (e.g. { table: 2 }). */
  skipped: Record<string, number>;
}

export type PutAsset = (bytes: Uint8Array, ext: string) => Promise<string>;

const SUPPORTED_IMAGES = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const EMU_PER_PT = 12700;

// ---------------------------------------------------------------- XML helpers

type El = globalThis.Element;

const local = (el: El) => el.localName;
const kids = (el: El | null | undefined, name?: string): El[] =>
  el ? [...el.children].filter((c) => !name || local(c) === name) : [];
const kid = (el: El | null | undefined, name: string): El | null => kids(el, name)[0] ?? null;
const path = (el: El | null | undefined, ...names: string[]): El | null =>
  names.reduce<El | null>((cur, n) => kid(cur, n), el ?? null);

function desc(el: El | null | undefined, name: string): El | null {
  if (!el) return null;
  for (const c of el.getElementsByTagName("*")) if (local(c) === name) return c;
  return null;
}

const num = (el: El | null | undefined, attr: string): number | undefined => {
  const v = el?.getAttribute(attr);
  return v == null || v === "" ? undefined : Number(v);
};

function parseXml(text: string): El {
  return new DOMParser().parseFromString(text, "application/xml").documentElement;
}

// ---------------------------------------------------------------- package

class Package {
  private xmlCache = new Map<string, El | null>();
  constructor(private files: Record<string, Uint8Array>) {}

  has(name: string): boolean {
    return name in this.files;
  }

  bytes(name: string): Uint8Array | undefined {
    return this.files[name];
  }

  xml(name: string): El | null {
    if (!this.xmlCache.has(name)) {
      const data = this.files[name];
      this.xmlCache.set(name, data ? parseXml(strFromU8(data)) : null);
    }
    return this.xmlCache.get(name) ?? null;
  }

  /** Relationships of a part: id → { type, target (resolved path) }. */
  rels(part: string): Map<string, { type: string; target: string }> {
    const dir = part.slice(0, part.lastIndexOf("/") + 1);
    const relsPath = `${dir}_rels/${part.slice(dir.length)}.rels`;
    const out = new Map<string, { type: string; target: string }>();
    for (const r of kids(this.xml(relsPath), "Relationship")) {
      const target = r.getAttribute("Target") ?? "";
      if (r.getAttribute("TargetMode") === "External") continue;
      out.set(r.getAttribute("Id") ?? "", {
        type: r.getAttribute("Type") ?? "",
        target: resolvePath(dir, target),
      });
    }
    return out;
  }

  relOfType(part: string, typeSuffix: string): string | undefined {
    for (const r of this.rels(part).values()) if (r.type.endsWith(typeSuffix)) return r.target;
    return undefined;
  }
}

export function resolvePath(dir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = (dir + target).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

// ---------------------------------------------------------------- colors

type Theme = Record<string, string>;

function readTheme(pkg: Package, masterPart: string): Theme {
  const themePart = pkg.relOfType(masterPart, "/theme");
  const scheme = desc(themePart ? pkg.xml(themePart) : null, "clrScheme");
  const theme: Theme = {};
  for (const c of kids(scheme)) {
    const srgb = kid(c, "srgbClr")?.getAttribute("val");
    const sys = kid(c, "sysClr")?.getAttribute("lastClr");
    if (srgb ?? sys) theme[local(c)] = `#${(srgb ?? sys)!.toLowerCase()}`;
  }
  // Default color map of a master: text = dark 1, background = light 1.
  theme.tx1 ??= theme.dk1 ?? "#000000";
  theme.bg1 ??= theme.lt1 ?? "#ffffff";
  theme.tx2 ??= theme.dk2 ?? theme.tx1;
  theme.bg2 ??= theme.lt2 ?? theme.bg1;
  return theme;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Color of a color element (srgbClr, schemeClr, sysClr, prstClr) with lumMod/lumOff. */
function colorOf(el: El | null, theme: Theme): string | undefined {
  if (!el) return undefined;
  let hex: string | undefined;
  const name = local(el);
  if (name === "srgbClr") hex = `#${(el.getAttribute("val") ?? "000000").toLowerCase()}`;
  else if (name === "sysClr") hex = `#${(el.getAttribute("lastClr") ?? "000000").toLowerCase()}`;
  else if (name === "schemeClr") hex = theme[el.getAttribute("val") ?? ""];
  else if (name === "prstClr") hex = el.getAttribute("val") === "white" ? "#ffffff" : "#000000";
  if (!hex) return undefined;
  const lumMod = num(kid(el, "lumMod"), "val");
  const lumOff = num(kid(el, "lumOff"), "val");
  const tint = num(kid(el, "tint"), "val");
  const shade = num(kid(el, "shade"), "val");
  if (lumMod !== undefined || lumOff !== undefined || tint !== undefined || shade !== undefined) {
    const [h, s, lightness] = hexToHsl(hex);
    let l = lightness;
    if (lumMod !== undefined) l *= lumMod / 100000;
    if (lumOff !== undefined) l += lumOff / 100000;
    if (tint !== undefined) l = l + (1 - l) * (1 - tint / 100000);
    if (shade !== undefined) l *= shade / 100000;
    hex = hslToHex(h, s, Math.min(1, Math.max(0, l)));
  }
  return hex;
}

/** Color of a fill container (solidFill, or the first stop of a gradient). */
function fillColor(parent: El | null, theme: Theme): string | null | undefined {
  if (!parent) return undefined;
  if (kid(parent, "noFill")) return null;
  const solid = kid(parent, "solidFill");
  if (solid) return colorOf(kids(solid)[0] ?? null, theme);
  const grad = kid(parent, "gradFill");
  if (grad) return colorOf(kids(desc(grad, "gs"))[0] ?? null, theme);
  return undefined;
}

// ---------------------------------------------------------------- geometry

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/** Maps a group's child coordinates (chOff/chExt) to its parent's. */
type Transform = (b: Box) => Box;
const identity: Transform = (b) => b;

function readXfrm(xfrm: El | null): Box | null {
  const off = kid(xfrm, "off");
  const ext = kid(xfrm, "ext");
  if (!off || !ext) return null;
  return {
    x: num(off, "x") ?? 0,
    y: num(off, "y") ?? 0,
    w: num(ext, "cx") ?? 0,
    h: num(ext, "cy") ?? 0,
    rot: (num(xfrm, "rot") ?? 0) / 60000,
  };
}

function groupTransform(grpSp: El, outer: Transform): Transform {
  const xfrm = path(grpSp, "grpSpPr", "xfrm");
  const box = readXfrm(xfrm);
  const chOff = kid(xfrm, "chOff");
  const chExt = kid(xfrm, "chExt");
  if (!box || !chOff || !chExt) return outer;
  const cx = num(chOff, "x") ?? 0;
  const cy = num(chOff, "y") ?? 0;
  const sx = box.w / (num(chExt, "cx") || box.w || 1);
  const sy = box.h / (num(chExt, "cy") || box.h || 1);
  return (b) =>
    outer({
      x: box.x + (b.x - cx) * sx,
      y: box.y + (b.y - cy) * sy,
      w: b.w * sx,
      h: b.h * sy,
      rot: b.rot + box.rot,
    });
}

// ---------------------------------------------------------------- placeholders and styles

interface Ph {
  type: string;
  idx: string | null;
}

function placeholderOf(shape: El): Ph | null {
  const ph = desc(kid(shape, "nvSpPr") ?? kid(shape, "nvPicPr"), "ph");
  if (!ph) return null;
  return { type: ph.getAttribute("type") ?? "body", idx: ph.getAttribute("idx") };
}

/** Placeholder families used to match slide → layout → master. */
function family(type: string): string {
  if (type === "ctrTitle" || type === "title") return "title";
  if (type === "subTitle" || type === "obj" || type === "body") return "body";
  return type;
}

function findPlaceholder(tree: El | null, ph: Ph): El | null {
  if (!tree) return null;
  const shapes = kids(path(tree, "cSld", "spTree"));
  const byIdx = ph.idx !== null ? shapes.find((s) => placeholderOf(s)?.idx === ph.idx) : undefined;
  if (byIdx) return byIdx;
  return (
    shapes.find((s) => {
      const p = placeholderOf(s);
      return p !== null && family(p.type) === family(ph.type);
    }) ?? null
  );
}

/** Paragraph style levels (a:lvl1pPr…) from most to least specific. */
interface StyleChain {
  levels: (lvl: number) => El[];
}

function styleChain(sources: (El | null)[]): StyleChain {
  return {
    levels: (lvl) =>
      sources.map((s) => kid(s, `lvl${lvl + 1}pPr`)).filter((x): x is El => x !== null),
  };
}

// ---------------------------------------------------------------- import

interface Context {
  pkg: Package;
  theme: Theme;
  scale: number;
  page: { width: number; height: number };
  putAsset: PutAsset;
  skipped: Record<string, number>;
  masterTxStyles: El | null;
}

const skip = (ctx: Context, what: string) => (ctx.skipped[what] = (ctx.skipped[what] ?? 0) + 1);

export async function importPptx(
  bytes: Uint8Array,
  options: { lang: string; title?: string; putAsset: PutAsset },
): Promise<ImportResult> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("not a .pptx file");
  }
  const pkg = new Package(files);
  const presPart = "ppt/presentation.xml";
  const pres = pkg.xml(presPart);
  if (!pres) throw new Error("not a .pptx file");

  const sldSz = kid(pres, "sldSz");
  const cx = num(sldSz, "cx") ?? 12192000;
  const cy = num(sldSz, "cy") ?? 6858000;
  const ratio = cx / cy;
  const fourThree = Math.abs(ratio - 4 / 3) < 0.05;
  const width = fourThree ? 1440 : 1920;
  const height = Math.round((width * cy) / cx);

  const presRels = pkg.rels(presPart);
  const slideParts = kids(kid(pres, "sldIdLst"), "sldId")
    .map((s) => presRels.get(s.getAttribute("r:id") ?? "")?.target)
    .filter((p): p is string => !!p && pkg.has(p));

  const skipped: Record<string, number> = {};
  const slides: Slide[] = [];
  for (const part of slideParts) {
    slides.push(
      await importSlide(pkg, part, width / cx, { width, height }, options.putAsset, skipped),
    );
  }
  if (slides.length === 0) throw new Error("the presentation has no slides");

  const now = new Date().toISOString();
  const title = desc(pkg.xml("docProps/core.xml"), "title")?.textContent?.trim();
  return {
    doc: {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        title: title || options.title || "",
        created: now,
        modified: now,
        lang: options.lang,
      },
      page: { aspect: fourThree ? "4:3" : "16:9", width, height },
      latex: { preamble: "" },
      slides,
    },
    skipped,
  };
}

async function importSlide(
  pkg: Package,
  part: string,
  scale: number,
  page: { width: number; height: number },
  putAsset: PutAsset,
  skipped: Record<string, number>,
): Promise<Slide> {
  const slide = pkg.xml(part)!;
  const layoutPart = pkg.relOfType(part, "/slideLayout");
  const layout = layoutPart ? pkg.xml(layoutPart) : null;
  const masterPart = layoutPart ? pkg.relOfType(layoutPart, "/slideMaster") : undefined;
  const master = masterPart ? pkg.xml(masterPart) : null;
  const ctx: Context = {
    pkg,
    theme: masterPart ? readTheme(pkg, masterPart) : { tx1: "#000000", bg1: "#ffffff" },
    scale,
    page,
    putAsset,
    skipped,
    masterTxStyles: kid(master, "txStyles"),
  };

  const elements: Element[] = [];
  let background: string | undefined;

  // Background: slide, else layout, else master. Pictures become a full-slide image.
  for (const [src, srcPart] of [
    [slide, part],
    [layout, layoutPart],
    [master, masterPart],
  ] as const) {
    const bg = path(src, "cSld", "bg");
    if (!bg) continue;
    const bgPr = kid(bg, "bgPr");
    const color =
      fillColor(bgPr, ctx.theme) ?? colorOf(kids(kid(bg, "bgRef"))[0] ?? null, ctx.theme);
    if (color) background = color;
    const blip = desc(bgPr, "blip");
    if (blip && srcPart) {
      const pic = await pictureElement(
        ctx,
        srcPart,
        blip,
        { x: 0, y: 0, w: 0, h: 0, rot: 0 },
        true,
      );
      if (pic) elements.push(pic);
    }
    break;
  }

  // Decorations from the master and layout (logos, bars…), unless the slide hides them.
  const showMaster = slide.getAttribute("showMasterSp") !== "0";
  if (showMaster && layout?.getAttribute("showMasterSp") !== "0" && master && masterPart) {
    await walk(
      ctx,
      masterPart,
      kids(path(master, "cSld", "spTree")),
      identity,
      elements,
      { layout: null, master: null },
      true,
    );
  }
  if (showMaster && layout && layoutPart) {
    await walk(
      ctx,
      layoutPart,
      kids(path(layout, "cSld", "spTree")),
      identity,
      elements,
      { layout: null, master },
      true,
    );
  }
  await walk(
    ctx,
    part,
    kids(path(slide, "cSld", "spTree")),
    identity,
    elements,
    { layout, master },
    false,
  );

  return {
    id: newId(),
    ...(background ? { background } : { background: "#ffffff" }),
    elements,
    notes: readNotes(pkg, part),
    hidden: slide.getAttribute("show") === "0",
  };
}

function readNotes(pkg: Package, slidePart: string): string {
  const notesPart = pkg.relOfType(slidePart, "/notesSlide");
  const notes = notesPart ? pkg.xml(notesPart) : null;
  for (const sp of kids(path(notes, "cSld", "spTree"), "sp")) {
    if (placeholderOf(sp)?.type !== "body") continue;
    return kids(kid(sp, "txBody"), "p")
      .map((p) =>
        [...p.getElementsByTagName("*")]
          .filter((e) => local(e) === "t")
          .map((t) => t.textContent ?? "")
          .join(""),
      )
      .join("\n")
      .trim();
  }
  return "";
}

interface Inherit {
  layout: El | null;
  master: El | null;
}

/** Converts the shapes of a shape tree, in z-order. `decor`: master/layout content. */
async function walk(
  ctx: Context,
  part: string,
  shapes: El[],
  transform: Transform,
  out: Element[],
  inherit: Inherit,
  decor: boolean,
): Promise<void> {
  for (const shape of shapes) {
    switch (local(shape)) {
      case "sp":
        out.push(...shapeElements(ctx, shape, transform, inherit, decor));
        break;
      case "cxnSp":
        out.push(...shapeElements(ctx, shape, transform, inherit, decor));
        break;
      case "pic": {
        if (decor && placeholderOf(shape)) break;
        const box = readXfrm(path(shape, "spPr", "xfrm"));
        const blip = desc(kid(shape, "blipFill"), "blip");
        if (box && blip) {
          const el = await pictureElement(ctx, part, blip, transform(box), false);
          if (el) out.push(el);
        }
        if (desc(shape, "videoFile") || desc(shape, "audioFile")) skip(ctx, "media");
        break;
      }
      case "grpSp":
        await walk(ctx, part, kids(shape), groupTransform(shape, transform), out, inherit, decor);
        break;
      case "graphicFrame": {
        const uri = desc(shape, "graphicData")?.getAttribute("uri") ?? "";
        skip(
          ctx,
          uri.includes("table")
            ? "table"
            : uri.includes("chart")
              ? "chart"
              : uri.includes("diagram")
                ? "diagram"
                : "object",
        );
        break;
      }
      case "AlternateContent": {
        // Newer features with a fallback (e.g. equations): use the fallback content.
        const fallback = kid(shape, "Fallback");
        if (desc(shape, "oMath") || desc(shape, "oMathPara")) skip(ctx, "equation");
        if (fallback) await walk(ctx, part, kids(fallback), transform, out, inherit, decor);
        break;
      }
    }
  }
}

function toElementBox(ctx: Context, b: Box) {
  const s = ctx.scale;
  return {
    x: b.x * s,
    y: b.y * s,
    w: Math.max(1, b.w * s),
    h: Math.max(1, b.h * s),
    rotation: ((b.rot % 360) + 360) % 360,
  };
}

const SHAPE_MAP: Record<string, ShapeKind> = {
  rect: "rect",
  roundRect: "rect",
  snip1Rect: "rect",
  snip2SameRect: "rect",
  round1Rect: "rect",
  round2SameRect: "rect",
  flowChartProcess: "rect",
  flowChartAlternateProcess: "rect",
  ellipse: "ellipse",
  flowChartConnector: "ellipse",
  line: "line",
  straightConnector1: "line",
  bentConnector2: "line",
  bentConnector3: "line",
  curvedConnector3: "line",
};

function shapeElements(
  ctx: Context,
  shape: El,
  transform: Transform,
  inherit: Inherit,
  decor: boolean,
): Element[] {
  const ph = placeholderOf(shape);
  // Layout/master placeholders are prompts ("Click to add title"), not content.
  if (decor && ph) return [];
  if (ph && (ph.type === "dt" || ph.type === "ftr" || ph.type === "sldNum") && !hasText(shape))
    return [];

  const layoutPh = ph ? findPlaceholder(inherit.layout, ph) : null;
  const masterPh = ph ? findPlaceholder(inherit.master, ph) : null;
  const spPr = kid(shape, "spPr");
  const box =
    readXfrm(kid(spPr, "xfrm")) ??
    readXfrm(path(layoutPh, "spPr", "xfrm")) ??
    readXfrm(path(masterPh, "spPr", "xfrm"));
  if (!box) return [];
  const geo = toElementBox(ctx, transform(box));
  const base = { id: "", ...geo, opacity: 1, locked: false };
  const out: Element[] = [];

  // Shape body (fill / outline).
  const prst =
    desc(spPr, "prstGeom")?.getAttribute("prst") ?? (local(shape) === "cxnSp" ? "line" : "rect");
  const style = kid(shape, "style");
  const fill =
    fillColor(spPr, ctx.theme) ??
    (num(kid(style, "fillRef"), "idx")
      ? colorOf(kids(kid(style, "fillRef"))[0] ?? null, ctx.theme)
      : undefined);
  const ln = kid(spPr, "ln");
  const lineColor =
    fillColor(ln, ctx.theme) ??
    (num(kid(style, "lnRef"), "idx")
      ? colorOf(kids(kid(style, "lnRef"))[0] ?? null, ctx.theme)
      : undefined);
  const lineWidth = Math.max(1, (num(ln, "w") ?? 12700) * ctx.scale);
  const kind = SHAPE_MAP[prst] ?? (fill || lineColor ? "rect" : undefined);
  if (prst && !SHAPE_MAP[prst] && (fill || lineColor)) skip(ctx, "shapeApprox");
  if (kind && (fill || lineColor)) {
    const isLine = kind === "line";
    const arrow = isLine && (kid(ln, "tailEnd")?.getAttribute("type") ?? "none") !== "none";
    const headArrow = isLine && (kid(ln, "headEnd")?.getAttribute("type") ?? "none") !== "none";
    const xfrm = kid(spPr, "xfrm");
    out.push({
      ...base,
      id: newId(),
      ...(isLine
        ? lineGeometry(
            geo,
            xfrm?.getAttribute("flipH") === "1",
            xfrm?.getAttribute("flipV") === "1",
          )
        : {}),
      kind: "shape",
      shape: arrow || headArrow ? "arrow" : kind,
      ...(fill && !isLine ? { fill } : {}),
      ...(lineColor ? { stroke: { color: lineColor, width: lineWidth } } : {}),
      radius: prst === "roundRect" ? Math.min(geo.w, geo.h) * 0.16 : 0,
    } as Element);
  }

  // Text.
  if (hasText(shape)) {
    const text = textElement(ctx, shape, geo, ph, layoutPh, masterPh);
    if (text) out.push(text);
  }
  return out;
}

/**
 * PowerPoint lines go corner to corner of their box (flips choose the diagonal). Tiza
 * draws a line horizontally across its box, rotated: same center, length = diagonal.
 */
export function lineGeometry(
  geo: { x: number; y: number; w: number; h: number; rotation: number },
  flipH: boolean,
  flipV: boolean,
) {
  const length = Math.hypot(geo.w, geo.h);
  let angle = (Math.atan2(geo.h, geo.w) * 180) / Math.PI;
  if (flipH !== flipV) angle = -angle;
  const cx = geo.x + geo.w / 2;
  const cy = geo.y + geo.h / 2;
  const thickness = 40;
  return {
    x: cx - length / 2,
    y: cy - thickness / 2,
    w: Math.max(1, length),
    h: thickness,
    rotation: (((geo.rotation + angle) % 360) + 360) % 360,
  };
}

function hasText(shape: El): boolean {
  const body = kid(shape, "txBody");
  return (
    !!body &&
    [...body.getElementsByTagName("*")].some(
      (e) => local(e) === "t" && (e.textContent ?? "").length > 0,
    )
  );
}

interface RunStyle {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
}

function runStyle(rPr: El | null, theme: Theme): RunStyle {
  if (!rPr) return {};
  const b = rPr.getAttribute("b");
  const i = rPr.getAttribute("i");
  const u = rPr.getAttribute("u");
  const strike = rPr.getAttribute("strike");
  return {
    size: num(rPr, "sz") !== undefined ? num(rPr, "sz")! / 100 : undefined,
    bold: b === null ? undefined : b === "1" || b === "true",
    italic: i === null ? undefined : i === "1" || i === "true",
    underline: u === null ? undefined : u !== "none",
    strike: strike === null ? undefined : strike !== "noStrike",
    color: fillColor(rPr, theme) ?? undefined,
  };
}

const merge = (...styles: RunStyle[]): RunStyle =>
  styles.reduce<RunStyle>((acc, s) => {
    for (const [k, v] of Object.entries(s))
      if (v !== undefined && acc[k as keyof RunStyle] === undefined)
        (acc as Record<string, unknown>)[k] = v;
    return acc;
  }, {});

function textElement(
  ctx: Context,
  shape: El,
  geo: ReturnType<typeof toElementBox>,
  ph: Ph | null,
  layoutPh: El | null,
  masterPh: El | null,
): Element | null {
  const body = kid(shape, "txBody")!;
  const bodyPr = kid(body, "bodyPr");
  const fontScale = (num(kid(bodyPr, "normAutofit"), "fontScale") ?? 100000) / 100000;
  const fam = ph ? family(ph.type) : "other";
  const masterStyle =
    fam === "title"
      ? kid(ctx.masterTxStyles, "titleStyle")
      : fam === "body"
        ? kid(ctx.masterTxStyles, "bodyStyle")
        : kid(ctx.masterTxStyles, "otherStyle");
  // Only placeholders inherit the master's title/body styles; text boxes use "other".
  const chain = styleChain([
    kid(body, "lstStyle"),
    path(layoutPh, "txBody", "lstStyle"),
    path(masterPh, "txBody", "lstStyle"),
    masterStyle,
  ]);

  const paragraphs: RichNode[] = [];
  let firstSize: number | undefined;
  let firstColor: string | undefined;
  let align: TextAlign | undefined;
  let list: RichNode | null = null;

  for (const p of kids(body, "p")) {
    const pPr = kid(p, "pPr");
    const lvl = num(pPr, "lvl") ?? 0;
    const levels = [pPr, ...chain.levels(lvl)].filter((x): x is El => x !== null);
    const levelDefaults = merge(...levels.map((l) => runStyle(kid(l, "defRPr"), ctx.theme)));
    const algn = levels.map((l) => l.getAttribute("algn")).find((a) => a);
    if (align === undefined && algn)
      align = algn === "ctr" ? "center" : algn === "r" ? "right" : "left";

    // Bullets: the first level that says something about bullets wins.
    const bulletLevel = levels.find(
      (l) => kid(l, "buNone") || kid(l, "buChar") || kid(l, "buAutoNum"),
    );
    const bullet =
      bulletLevel && !kid(bulletLevel, "buNone")
        ? kid(bulletLevel, "buAutoNum")
          ? "orderedList"
          : "bulletList"
        : null;

    const content: RichNode[] = [];
    for (const r of kids(p)) {
      const name = local(r);
      if (name === "br") {
        content.push({ type: "hardBreak" });
        continue;
      }
      if (name !== "r" && name !== "fld") continue;
      const text = kid(r, "t")?.textContent ?? "";
      if (!text) continue;
      const style = merge(runStyle(kid(r, "rPr"), ctx.theme), levelDefaults);
      firstSize ??= style.size;
      firstColor ??= style.color;
      const marks = (["bold", "italic", "underline", "strike"] as const)
        .filter((m) => style[m])
        .map((m) => ({ type: m }));
      content.push({ type: "text", text, ...(marks.length ? { marks } : {}) });
    }
    if (firstSize === undefined) firstSize = levelDefaults.size;
    const paragraph: RichNode = { type: "paragraph", ...(content.length ? { content } : {}) };

    if (bullet && content.length) {
      if (!list || list.type !== bullet) {
        list = { type: bullet, content: [] };
        paragraphs.push(list);
      }
      list.content!.push({ type: "listItem", content: [paragraph] });
    } else {
      list = null;
      paragraphs.push(paragraph);
    }
  }
  if (paragraphs.length === 0) return null;

  // Text insets (defaults 0.1" left/right, 0.05" top/bottom).
  const s = ctx.scale;
  const lIns = (num(bodyPr, "lIns") ?? 91440) * s;
  const rIns = (num(bodyPr, "rIns") ?? 91440) * s;
  const tIns = (num(bodyPr, "tIns") ?? 45720) * s;
  const pt = (firstSize ?? 18) * fontScale;
  return {
    id: newId(),
    x: geo.x + lIns,
    y: geo.y + tIns,
    w: Math.max(10, geo.w - lIns - rIns),
    h: Math.max(10, geo.h - tIns),
    rotation: geo.rotation,
    opacity: 1,
    locked: false,
    kind: "text",
    doc: { type: "doc", content: paragraphs },
    fontSize: Math.max(4, Math.round(pt * EMU_PER_PT * s * 10) / 10),
    color: firstColor ?? ctx.theme.tx1 ?? "#000000",
    align: align ?? (fam === "title" && ph?.type === "ctrTitle" ? "center" : "left"),
  } as Element;
}

async function pictureElement(
  ctx: Context,
  part: string,
  blip: El,
  box: Box,
  background: boolean,
): Promise<Element | null> {
  const id = blip.getAttribute("r:embed");
  const target = id ? ctx.pkg.rels(part).get(id)?.target : undefined;
  const bytes = target ? ctx.pkg.bytes(target) : undefined;
  if (!target || !bytes) return null;
  const ext = target.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_IMAGES.has(ext)) {
    skip(ctx, "imageFormat");
    return null;
  }
  const asset = await ctx.putAsset(bytes, ext);
  const geo = background
    ? { x: 0, y: 0, w: ctx.page.width, h: ctx.page.height, rotation: 0 }
    : toElementBox(ctx, box);
  return {
    id: newId(),
    ...geo,
    opacity: 1,
    locked: background,
    kind: "image",
    asset,
    fit: "fill",
  } as Element;
}
