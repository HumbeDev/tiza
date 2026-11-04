// Runs MCP tool calls (forwarded by Rust as `mcp:request` events) on the editor's store.
// Each call is one undo step. Messages are in English: they are read by AI agents.
import type { Draft } from "immer";
import { create } from "zustand";
import type {
  BuildEffect,
  Element,
  ImageElement,
  RichNode,
  ShapeKind,
  Slide,
  TableTheme,
  TextAlign,
  TransitionKind,
} from "../document";
import {
  createEmbed,
  createImage,
  createVideo,
  createShape,
  createSim,
  createTable,
  createText,
} from "../document/factory";
import { embedFields, parseEmbed } from "../elements/embed/parse";
import { canvasToBytes, renderFrame } from "../export/capture";
import { exportHtml, exportPdf, exportPng } from "../export/export";
import {
  type TextStyleChange,
  alignParagraphs,
  styleText,
  toPlainText,
} from "../document/richtext";
import { save as saveFile } from "../files/session";
import {
  type ZOrder,
  addBlankSlide,
  groupElements,
  ungroupElements,
  editMaster,
  addElement,
  addSlide,
  batch,
  change,
  deleteSlide,
  duplicateSlide,
  insertMath,
  moveSlide,
  reorderSelected,
  select,
  selectSlide,
  setBuild,
  setDocTransition,
  setExit,
  setMathFontSize,
  setMathLatex,
  setPreamble,
  undo,
  updateElements,
  useEditor,
} from "../store/editor";
import { agentTextToDoc } from "./text";

type Args = Record<string, unknown>;

class ToolError extends Error {}

const state = useEditor.getState;

/** Binary results travel to Rust as base64 inside the JSON reply. */
function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function slideOf(ref: unknown): { slide: Slide; index: number } {
  if (ref === "master") {
    // The master slide is created the first time an agent uses it.
    if (!state().doc.master) {
      const current = state().currentSlideId;
      editMaster();
      selectSlide(current);
    }
    return { slide: state().doc.master!, index: -1 };
  }
  const slides = state().doc.slides;
  const index =
    typeof ref === "number"
      ? ref - 1
      : typeof ref === "string"
        ? slides.findIndex((s) => s.id === ref)
        : -1;
  const slide = slides[index];
  if (!slide) {
    throw new ToolError(
      `No slide ${JSON.stringify(ref)}. The presentation has ${slides.length} slides (1-${slides.length}).`,
    );
  }
  return { slide, index };
}

function elementOf(id: unknown): { el: Element; slide: Slide } {
  for (const slide of state().doc.slides) {
    const el = slide.elements.find((e) => e.id === id);
    if (el) return { el, slide };
  }
  throw new ToolError(
    `No element with id ${JSON.stringify(id)}. Call get_presentation to see the ids.`,
  );
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Shows the slide the agent is working on, so the user sees the change happen. */
function focus(slide: Slide, elementIds: string[] = []) {
  selectSlide(slide.id);
  select(elementIds);
}

/** Places a new element on `slide` with the frame the agent gave (defaults: centered). */
function place(el: Element, frame: Args, slide: Slide): Element {
  const page = state().doc.page;
  const w = num(frame.w) ?? el.w;
  const h = num(frame.h) ?? el.h;
  const x =
    num(frame.x) ?? (num(frame.cx) !== undefined ? num(frame.cx)! - w / 2 : (page.width - w) / 2);
  const y =
    num(frame.y) ?? (num(frame.cy) !== undefined ? num(frame.cy)! - h / 2 : (page.height - h) / 2);
  selectSlide(slide.id);
  return { ...el, x, y, w, h };
}

function summary(el: Element): string {
  switch (el.kind) {
    case "text":
      return toPlainText(el.doc).slice(0, 200);
    case "math":
      return el.latex;
    case "shape":
      return el.shape;
    case "table":
      return `${el.rows.length}×${Math.max(0, ...el.rows.map((r) => r.length))} table: ${(el.rows[0] ?? []).join(" | ").slice(0, 120)}`;
    case "sim":
      return `HTML page "${el.title}"`;
    case "embed":
      return `${{ youtube: "YouTube video", x: "X post", web: "web page" }[el.provider]} ${el.url}`;
    case "image":
    case "video":
      return el.asset;
  }
}

const round = (v: number) => Math.round(v * 10) / 10;

const tools: Record<string, (args: Args) => unknown> = {
  get_presentation() {
    const s = state();
    return {
      title: s.doc.meta.title,
      file: s.file.name,
      page: { width: s.doc.page.width, height: s.doc.page.height },
      currentSlide: s.doc.slides.findIndex((sl) => sl.id === s.currentSlideId) + 1,
      hasTemplate: !!s.doc.template,
      ...(s.doc.master
        ? {
            master: s.doc.master.elements.map((el) => ({
              id: el.id,
              kind: el.kind,
              x: round(el.x),
              y: round(el.y),
              w: round(el.w),
              h: round(el.h),
              content: summary(el),
            })),
          }
        : {}),
      latexPreamble: s.doc.latex.preamble,
      slides: s.doc.slides.map((slide, i) => ({
        number: i + 1,
        id: slide.id,
        hidden: slide.hidden,
        ...(slide.hideMaster ? { hideMaster: true } : {}),
        background: slide.background,
        notes: slide.notes,
        elements: slide.elements.map((el) => ({
          id: el.id,
          kind: el.kind,
          x: round(el.x),
          y: round(el.y),
          w: round(el.w),
          h: round(el.h),
          ...(el.rotation ? { rotation: el.rotation } : {}),
          ...(el.build ? { appearsOnClick: el.build.step } : {}),
          content: summary(el),
        })),
      })),
    };
  },

  async render_slide(args) {
    const { slide, index } = slideOf(args.slide);
    const doc = state().doc;
    const width = Math.min(3840, Math.max(160, num(args.width) ?? 1280));
    const step = num(args.step);
    const canvas = await renderFrame(doc, { slide, step }, width / doc.page.width);
    return {
      base64: bytesToBase64(await canvasToBytes(canvas, "image/png")),
      slide: index + 1,
      width: canvas.width,
      height: canvas.height,
      ...(slide.hidden ? { note: "This slide is hidden in the presentation." } : {}),
    };
  },

  async export_presentation(args) {
    const doc = state().doc;
    const format = String(args.format);
    const result =
      format === "pdf" || format === "pdf_steps"
        ? await exportPdf(doc, format === "pdf_steps")
        : format === "html"
          ? await exportHtml(doc)
          : format === "png"
            ? await exportPng(
                doc,
                Array.isArray(args.slides)
                  ? args.slides.map((s) => slideOf(s).slide.id)
                  : undefined,
              )
            : null;
    if (!result) throw new ToolError("format must be pdf, pdf_steps, png or html");
    return { base64: bytesToBase64(result.bytes), format: result.format };
  },

  get_slide({ slide }) {
    const found = slideOf(slide);
    return {
      number: found.index + 1,
      ...found.slide,
      // Long HTML is cut: it isn't useful for layout decisions.
      elements: found.slide.elements.map((el) =>
        el.kind === "sim" && el.html.length > 4000
          ? { ...el, html: `${el.html.slice(0, 4000)}…` }
          : el,
      ),
    };
  },

  add_slide({ after, use_template }) {
    const slides = state().doc.slides;
    const anchor =
      after === undefined || after === null ? slides[slides.length - 1] : slideOf(after).slide;
    selectSlide(anchor.id);
    if (use_template === false) addBlankSlide();
    else addSlide();
    const s = state();
    return {
      slide_id: s.currentSlideId,
      number: s.doc.slides.findIndex((sl) => sl.id === s.currentSlideId) + 1,
    };
  },

  duplicate_slide({ slide }) {
    duplicateSlide(slideOf(slide).slide.id);
    const s = state();
    return {
      slide_id: s.currentSlideId,
      number: s.doc.slides.findIndex((sl) => sl.id === s.currentSlideId) + 1,
    };
  },

  delete_slide({ slide }) {
    if (state().doc.slides.length <= 1) throw new ToolError("Can't delete the only slide.");
    deleteSlide(slideOf(slide).slide.id);
    return { slides: state().doc.slides.length };
  },

  move_slide({ slide, to }) {
    const { index } = slideOf(slide);
    const count = state().doc.slides.length;
    const target = Math.min(Math.max(1, num(to) ?? 1), count) - 1;
    moveSlide(index, target);
    return { number: target + 1 };
  },

  go_to_slide({ slide }) {
    focus(slideOf(slide).slide);
    return { ok: true };
  },

  set_slide({ slide, background, notes, hidden, transition, duration_ms, hide_master }) {
    const { slide: target } = slideOf(slide);
    if (target.id === state().doc.master?.id)
      throw new ToolError("set_slide doesn't apply to the master slide");
    change((doc) => {
      const s = doc.slides.find((x) => x.id === target.id)!;
      if (typeof hide_master === "boolean") {
        if (hide_master) s.hideMaster = true;
        else delete s.hideMaster;
      }
      if (typeof background === "string") s.background = background;
      if (typeof notes === "string") s.notes = notes;
      if (typeof hidden === "boolean") s.hidden = hidden;
      if (transition === "default") delete s.transition;
      else if (isTransition(transition))
        s.transition = { kind: transition, durationMs: num(duration_ms) ?? 500 };
    });
    focus(target);
    return { ok: true };
  },

  add_text(args) {
    const { slide } = slideOf(args.slide);
    const el = place(createText("", 0, 0), args, slide);
    if (el.kind !== "text") throw new ToolError("internal");
    const doc = agentTextToDoc(String(args.text ?? ""));
    if (args.bold || args.italic) {
      const marks = [
        ...(args.bold ? [{ type: "bold" }] : []),
        ...(args.italic ? [{ type: "italic" }] : []),
      ];
      const mark = (n: RichNode) => {
        if (n.type === "text") n.marks = [...(n.marks ?? []), ...marks];
        n.content?.forEach(mark);
      };
      doc.content?.forEach(mark);
    }
    const lines = Math.max(1, String(args.text ?? "").split("\n").length);
    const fontSize = num(args.font_size) ?? el.fontSize;
    const text: Element = {
      ...el,
      doc,
      fontSize,
      h: num(args.h) ?? Math.max(el.h, lines * fontSize * 1.3),
      ...(str(args.color) ? { color: str(args.color)! } : {}),
      ...(["left", "center", "right"].includes(String(args.align))
        ? { align: args.align as TextAlign }
        : {}),
    };
    addElement(text);
    return { element_id: text.id };
  },

  async add_equation(args) {
    const { slide } = slideOf(args.slide);
    selectSlide(slide.id);
    const page = state().doc.page;
    const id = await insertMath(
      String(args.latex ?? ""),
      num(args.cx) ?? page.width / 2,
      num(args.cy) ?? page.height / 2,
    );
    if (num(args.font_size)) setMathFontSize(id, num(args.font_size)!);
    if (str(args.color)) updateElements([id], { color: str(args.color)! });
    return { element_id: id };
  },

  add_shape(args) {
    const { slide } = slideOf(args.slide);
    const kind = String(args.shape) as ShapeKind;
    if (!["rect", "ellipse", "line", "arrow"].includes(kind))
      throw new ToolError(`Unknown shape "${kind}". Use rect, ellipse, line or arrow.`);
    const el = place(createShape(kind, 0, 0), args, slide);
    if (el.kind !== "shape") throw new ToolError("internal");
    const fill = str(args.fill);
    const shape: Element = {
      ...el,
      ...(fill === "none" ? { fill: undefined } : fill ? { fill } : {}),
      ...(str(args.stroke_color) || num(args.stroke_width)
        ? {
            stroke: {
              color: str(args.stroke_color) ?? "#1d1d1b",
              width: num(args.stroke_width) ?? 4,
            },
          }
        : {}),
      ...(num(args.radius) !== undefined ? { radius: num(args.radius)! } : {}),
    };
    addElement(shape);
    return { element_id: shape.id };
  },

  add_table(args) {
    const { slide } = slideOf(args.slide);
    const rows = parseRows(args.rows);
    const el = place(createTable(rows, 0, 0, num(args.font_size) ?? 30), args, slide);
    if (el.kind !== "table") throw new ToolError("internal");
    const table: Element = {
      ...el,
      ...(typeof args.header_row === "boolean" ? { headerRow: args.header_row } : {}),
      ...(typeof args.striped === "boolean" ? { striped: args.striped } : {}),
      ...(isTheme(args.theme) ? { theme: args.theme } : {}),
    };
    addElement(table);
    return { element_id: table.id };
  },

  add_html(args) {
    const { slide } = slideOf(args.slide);
    const el = place(
      createSim(String(args.html ?? ""), str(args.title) ?? "HTML", 0, 0),
      args,
      slide,
    );
    if (el.kind !== "sim") throw new ToolError("internal");
    const sim: Element = {
      ...el,
      ...(num(args.view_width) ? { viewWidth: num(args.view_width)! } : {}),
      ...(num(args.view_height) ? { viewHeight: num(args.view_height)! } : {}),
      allowNetwork: args.allow_network === true,
    };
    addElement(sim);
    return { element_id: sim.id };
  },

  add_embed(args) {
    const { slide } = slideOf(args.slide);
    const url = String(args.url ?? "").trim();
    const parsed = parseEmbed(url);
    if (!parsed)
      throw new ToolError(
        "url must be an http(s) link: a YouTube video, an X/Twitter post, a web page, or an embed code",
      );
    const start = num(args.start);
    const el = place(
      createEmbed(
        start && parsed.provider === "youtube" ? { ...parsed, start } : parsed,
        parsed.link,
        0,
        0,
      ),
      args,
      slide,
    );
    addElement(el);
    return { element_id: el.id, provider: parsed.provider };
  },

  add_video(args) {
    const { slide } = slideOf(args.slide);
    const page = state().doc.page;
    const el = place(createVideo(String(args.asset), page.width / 2, page.height / 2), args, slide);
    const video = {
      ...el,
      autoplay: args.autoplay === true,
      loop: args.loop === true,
      muted: args.muted === true,
      ...(num(args.start) ? { start: num(args.start) } : {}),
      ...(num(args.end) ? { end: num(args.end) } : {}),
    } as Element;
    addElement(video);
    return { element_id: video.id };
  },

  add_image(args) {
    const { slide } = slideOf(args.slide);
    const asset = args.asset as { name: string; width?: number; height?: number };
    const page = state().doc.page;
    const el = place(
      createImage(asset.name, asset, page.width / 2, page.height / 2),
      (args.frame ?? {}) as Args,
      slide,
    );
    addElement(el as Element & ImageElement);
    return { element_id: el.id };
  },

  async update_element({ element_id, changes }) {
    const { el, slide } = elementOf(element_id);
    if (typeof changes !== "object" || changes === null)
      throw new ToolError("changes must be an object");
    const c = changes as Args;
    const unknown: string[] = [];
    updateElements([el.id], (d: Draft<Element>) => {
      for (const [key, value] of Object.entries(c)) {
        if (!applyChange(d, key, value)) unknown.push(key);
      }
    });
    if (typeof c.latex === "string" && el.kind === "math") setMathLatex(el.id, c.latex);
    if (num(c.font_size) && el.kind === "math") setMathFontSize(el.id, num(c.font_size)!);
    focus(slide, [el.id]);
    return unknown.length ? { ok: true, ignored: unknown } : { ok: true };
  },

  style_text(args) {
    const { el } = elementOf(args.element_id);
    if (el.kind !== "text") throw new ToolError("style_text works on text boxes only");
    const style: TextStyleChange = {};
    if (typeof args.color === "string") style.color = args.color || null;
    if (num(args.font_size) !== undefined)
      style.fontSize = num(args.font_size)! > 0 ? num(args.font_size)! : null;
    for (const flag of ["bold", "italic", "underline"] as const)
      if (typeof args[flag] === "boolean") style[flag] = args[flag] as boolean;
    let doc = el.doc;
    let count = 0;
    if (Object.keys(style).length > 0) {
      ({ doc, count } = styleText(doc, str(args.match) ?? "", style));
      if (count === 0) throw new ToolError(`"${String(args.match)}" was not found in the text`);
    }
    if (typeof args.align === "string") {
      if (!["", "left", "center", "right", "justify"].includes(args.align))
        throw new ToolError("align must be left, center, right, justify or empty");
      const p = num(args.paragraph);
      doc = alignParagraphs(doc, (args.align || null) as "left" | null, p ? p - 1 : undefined);
    }
    updateElements([el.id], { doc } as Partial<Element>);
    return { styled: count };
  },

  group_elements({ element_ids }) {
    const ids = Array.isArray(element_ids) ? element_ids.map(String) : [];
    if (ids.length < 2) throw new ToolError("group_elements needs at least 2 element ids");
    const slides = new Set(ids.map((id) => elementOf(id).slide.id));
    if (slides.size > 1) throw new ToolError("all elements of a group must be on the same slide");
    return { group_id: groupElements(ids) };
  },

  ungroup_elements({ element_ids }) {
    const ids = Array.isArray(element_ids) ? element_ids.map(String) : [];
    ids.forEach(elementOf);
    ungroupElements(ids);
    return { ungrouped: ids.length };
  },

  delete_elements({ element_ids }) {
    const ids = new Set(Array.isArray(element_ids) ? element_ids.map(String) : []);
    let removed = 0;
    change((doc) => {
      for (const slide of doc.slides) {
        const before = slide.elements.length;
        slide.elements = slide.elements.filter((e) => !ids.has(e.id));
        removed += before - slide.elements.length;
      }
    });
    select([]);
    return { removed };
  },

  set_animation({ element_ids, step, effect, exit }) {
    const ids = Array.isArray(element_ids) ? element_ids.map(String) : [];
    ids.forEach((id) => elementOf(id));
    if (effect !== undefined && effect !== null && !EFFECTS.includes(effect as BuildEffect)) {
      throw new ToolError(`Unknown effect "${String(effect)}". Use one of: ${EFFECTS.join(", ")}.`);
    }
    const n = num(step);
    const build =
      n && n > 0
        ? { step: Math.round(n), effect: (effect as BuildEffect | undefined) ?? "appear" }
        : null;
    if (exit === true) setExit(ids, build);
    else setBuild(ids, build);
    return { ok: true };
  },

  set_presentation_transition({ transition, duration_ms, apply_to_all }) {
    if (!isTransition(transition))
      throw new ToolError('transition must be "none", "fade", "slide", "zoom" or "rise"');
    setDocTransition(
      transition === "none" ? null : { kind: transition, durationMs: num(duration_ms) ?? 500 },
      apply_to_all === true,
    );
    return { ok: true };
  },

  arrange({ element_ids, action }) {
    const ids = Array.isArray(element_ids) ? element_ids.map(String) : [];
    if (!["front", "back", "forward", "backward"].includes(String(action))) {
      throw new ToolError('action must be "front", "back", "forward" or "backward"');
    }
    const { slide } = elementOf(ids[0]);
    focus(slide, ids);
    reorderSelected(action as ZOrder);
    return { ok: true };
  },

  set_latex_preamble({ preamble }) {
    setPreamble(String(preamble ?? ""), "agent-preamble");
    return { ok: true };
  },

  undo() {
    undo();
    return { ok: true };
  },

  async save() {
    if (!state().file.path) {
      throw new ToolError(
        "The presentation has never been saved. Ask the user to save it once (Ctrl+S); then save works.",
      );
    }
    if (!(await saveFile())) throw new ToolError("Saving failed (see the message in the app).");
    return { saved: state().file.name };
  },
};

const THEMES: TableTheme[] = ["green", "blue", "gray", "orange", "purple"];
const EFFECTS: BuildEffect[] = ["appear", "fade", "rise", "fromLeft", "fromRight", "zoom", "wipe"];
const TRANSITIONS: TransitionKind[] = ["none", "fade", "slide", "zoom", "rise"];
const isTransition = (v: unknown): v is TransitionKind => TRANSITIONS.includes(v as TransitionKind);
const isTheme = (v: unknown): v is TableTheme => THEMES.includes(v as TableTheme);

function parseRows(value: unknown): string[][] {
  if (!Array.isArray(value) || !value.every(Array.isArray))
    throw new ToolError("rows must be an array of arrays of strings");
  return value.map((r: unknown[]) =>
    r.map((c) => (c === null || c === undefined ? "" : String(c))),
  );
}

/** Applies one `update_element` change; returns false for keys that don't apply. */
function applyChange(el: Draft<Element>, key: string, value: unknown): boolean {
  const n = num(value);
  const s = str(value);
  switch (key) {
    case "x":
    case "y":
    case "w":
    case "h":
    case "rotation":
    case "opacity":
      if (n === undefined) return false;
      el[key] = key === "opacity" ? Math.min(1, Math.max(0, n)) : n;
      return true;
    case "locked":
      el.locked = value === true;
      return true;
    case "color":
      if (!s || !("color" in el)) return false;
      (el as { color: string }).color = s;
      return true;
    case "font_size":
      if (n === undefined) return false;
      if (el.kind === "math") return true; // resized by setMathFontSize
      if (!("fontSize" in el)) return false;
      (el as { fontSize: number }).fontSize = n;
      return true;
    case "latex":
      return el.kind === "math"; // applied with setMathLatex (resizes the box)
    case "align":
      if (el.kind !== "text" || !["left", "center", "right"].includes(String(value))) return false;
      el.align = value as TextAlign;
      return true;
    case "text":
      if (el.kind !== "text" || s === undefined) return false;
      el.doc = agentTextToDoc(s);
      return true;
    case "fill":
      if (el.kind !== "shape") return false;
      el.fill = s && s !== "none" ? s : undefined;
      return true;
    case "stroke_color":
    case "stroke_width":
      if (el.kind !== "shape") return false;
      el.stroke = {
        color: key === "stroke_color" && s ? s : (el.stroke?.color ?? "#1d1d1b"),
        width: key === "stroke_width" && n !== undefined ? n : (el.stroke?.width ?? 4),
      };
      return true;
    case "rows":
      if (el.kind !== "table") return false;
      el.rows = parseRows(value);
      return true;
    case "header_row":
    case "striped":
      if (el.kind !== "table") return false;
      el[key === "header_row" ? "headerRow" : "striped"] = value === true;
      return true;
    case "theme":
      if (el.kind !== "table" || !isTheme(value)) return false;
      el.theme = value;
      return true;
    case "html":
    case "title":
      if (el.kind !== "sim" || s === undefined) return false;
      el[key] = s;
      return true;
    case "view_width":
    case "view_height":
      if (el.kind !== "sim" || n === undefined) return false;
      el[key === "view_width" ? "viewWidth" : "viewHeight"] = n;
      return true;
    case "url": {
      const parsed = s === undefined ? null : parseEmbed(s);
      if (el.kind !== "embed" || !parsed) return false;
      Object.assign(el, embedFields(parsed));
      return true;
    }
    case "start":
      if (el.kind === "video") {
        el.start = n && n > 0 ? n : undefined;
        return true;
      }
      if (el.kind !== "embed" || el.provider !== "youtube") return false;
      el.start = n && n > 0 ? Math.round(n) : undefined;
      return true;
    case "end":
      if (el.kind !== "video") return false;
      el.end = n && n > 0 ? n : undefined;
      return true;
    case "autoplay":
    case "loop":
    case "muted":
      if (el.kind !== "video" || typeof value !== "boolean") return false;
      el[key] = value;
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------- activity indicator

/** Time of the last agent call, for the "agent working" indicator. */
export const useAgentActivity = create<{ lastAt: number }>(() => ({ lastAt: 0 }));

export interface ToolRequest {
  id: number;
  tool: string;
  args: Args;
}

/** Runs one request; resolves with what to send back to Rust. */
export async function runTool(request: ToolRequest): Promise<{ ok: boolean; result: unknown }> {
  const tool = tools[request.tool];
  if (!tool) return { ok: false, result: `Unknown tool ${request.tool}` };
  useAgentActivity.setState({ lastAt: Date.now() });
  try {
    const readOnly =
      request.tool.startsWith("get_") ||
      ["undo", "save", "render_slide", "export_presentation"].includes(request.tool);
    const result = readOnly
      ? await tool(request.args ?? {})
      : await batch(() => tool(request.args ?? {}));
    return { ok: true, result: result ?? { ok: true } };
  } catch (e) {
    return { ok: false, result: e instanceof Error ? e.message : String(e) };
  }
}

/** Desktop editor window: executes the agent's requests forwarded by Rust. */
export async function listenForAgents(): Promise<() => void> {
  const [{ listen }, { invoke }] = await Promise.all([
    import("@tauri-apps/api/event"),
    import("@tauri-apps/api/core"),
  ]);
  return listen<ToolRequest>("mcp:request", async (event) => {
    const { ok, result } = await runTool(event.payload);
    await invoke("mcp_respond", { id: event.payload.id, ok, result });
  });
}
