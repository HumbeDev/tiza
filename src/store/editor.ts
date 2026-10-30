import { applyPatches, enablePatches, type Draft, type Patch, produceWithPatches } from "immer";
import { create } from "zustand";
import type { Element, Presentation, Slide } from "../document";
import { aabb, union } from "../document/geometry";
import { createPresentation, createSlide, newId } from "../document/factory";

enablePatches();

interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
  mergeKey?: string;
}

export interface EditorState {
  doc: Presentation;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** When false, the next change with the same mergeKey joins the last history entry. */
  sealed: boolean;
  currentSlideId: string;
  selectedIds: string[];
  editingId: string | null;
}

function initialState(doc: Presentation): EditorState {
  return {
    doc,
    past: [],
    future: [],
    sealed: true,
    currentSlideId: doc.slides[0].id,
    selectedIds: [],
    editingId: null,
  };
}

export const useEditor = create<EditorState>(() =>
  initialState(createPresentation("", navigator.language)),
);

const get = useEditor.getState;
const set = useEditor.setState;

export function loadDocument(doc: Presentation): void {
  set(initialState(doc), true);
}

// ---------------------------------------------------------------- history

/**
 * Applies a named change to the document and records it for undo. Consecutive changes
 * with the same `mergeKey` (e.g. every pointer move of one drag) become a single undo
 * step until `seal()` is called.
 */
export function change(recipe: (doc: Draft<Presentation>) => void, mergeKey?: string): void {
  const s = get();
  const [doc, patches, inverse] = produceWithPatches(s.doc, recipe);
  if (patches.length === 0) return;
  const last = s.past[s.past.length - 1];
  const past =
    mergeKey && last && !s.sealed && last.mergeKey === mergeKey
      ? [
          ...s.past.slice(0, -1),
          {
            patches: [...last.patches, ...patches],
            inverse: [...inverse, ...last.inverse],
            mergeKey,
          },
        ]
      : [...s.past, { patches, inverse, mergeKey }];
  set({ doc, past, future: [], sealed: !mergeKey });
}

export function seal(): void {
  set({ sealed: true });
}

export function undo(): void {
  const s = get();
  const entry = s.past[s.past.length - 1];
  if (!entry) return;
  set(
    fixSelection({
      ...s,
      doc: applyPatches(s.doc, entry.inverse),
      past: s.past.slice(0, -1),
      future: [entry, ...s.future],
      sealed: true,
    }),
  );
}

export function redo(): void {
  const s = get();
  const entry = s.future[0];
  if (!entry) return;
  set(
    fixSelection({
      ...s,
      doc: applyPatches(s.doc, entry.patches),
      past: [...s.past, entry],
      future: s.future.slice(1),
      sealed: true,
    }),
  );
}

/** Keeps the current slide and selection pointing at things that still exist. */
function fixSelection(s: EditorState): EditorState {
  const slide = s.doc.slides.find((sl) => sl.id === s.currentSlideId) ?? s.doc.slides[0];
  const ids = new Set(slide.elements.map((e) => e.id));
  return {
    ...s,
    currentSlideId: slide.id,
    selectedIds: s.selectedIds.filter((id) => ids.has(id)),
    editingId: s.editingId && ids.has(s.editingId) ? s.editingId : null,
  };
}

// ---------------------------------------------------------------- selectors

export const currentSlide = (s: EditorState): Slide =>
  s.doc.slides.find((sl) => sl.id === s.currentSlideId) ?? s.doc.slides[0];

export function selectedElements(s: EditorState): Element[] {
  const ids = new Set(s.selectedIds);
  return currentSlide(s).elements.filter((e) => ids.has(e.id));
}

function draftSlide(doc: Draft<Presentation>): Draft<Slide> {
  const id = get().currentSlideId;
  return doc.slides.find((sl) => sl.id === id) ?? doc.slides[0];
}

// ---------------------------------------------------------------- selection

export function selectSlide(id: string): void {
  if (get().currentSlideId === id) return;
  set({ currentSlideId: id, selectedIds: [], editingId: null });
}

export function select(ids: string[]): void {
  set({ selectedIds: ids, editingId: null });
}

export function toggleSelected(id: string): void {
  const { selectedIds } = get();
  select(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
}

export function selectAll(): void {
  select(currentSlide(get()).elements.map((e) => e.id));
}

export function startEditing(id: string): void {
  set({ selectedIds: [id], editingId: id });
}

export function stopEditing(): void {
  seal();
  set({ editingId: null });
}

// ---------------------------------------------------------------- slides

export function addSlide(): void {
  const slide = createSlide();
  const index = get().doc.slides.findIndex((s) => s.id === get().currentSlideId);
  change((doc) => {
    doc.slides.splice(index + 1, 0, slide);
  });
  selectSlide(slide.id);
}

export function duplicateSlide(id: string): void {
  const s = get();
  const index = s.doc.slides.findIndex((sl) => sl.id === id);
  if (index < 0) return;
  const copy: Slide = structuredClone(s.doc.slides[index]);
  copy.id = newId();
  copy.elements = copy.elements.map((e) => ({ ...e, id: newId() }));
  change((doc) => {
    doc.slides.splice(index + 1, 0, copy);
  });
  selectSlide(copy.id);
}

export function deleteSlide(id: string): void {
  const s = get();
  if (s.doc.slides.length <= 1) return;
  const index = s.doc.slides.findIndex((sl) => sl.id === id);
  if (index < 0) return;
  change((doc) => {
    doc.slides.splice(index, 1);
  });
  if (s.currentSlideId === id) {
    const slides = get().doc.slides;
    selectSlide(slides[Math.min(index, slides.length - 1)].id);
  }
}

export function moveSlide(from: number, to: number): void {
  const n = get().doc.slides.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
  change((doc) => {
    const [slide] = doc.slides.splice(from, 1);
    doc.slides.splice(to, 0, slide);
  });
}

export function setSlideBackground(color: string): void {
  change((doc) => {
    draftSlide(doc).background = color;
  }, "slide-background");
}

// ---------------------------------------------------------------- elements

export function addElement(element: Element): void {
  change((doc) => {
    draftSlide(doc).elements.push(element);
  });
  select([element.id]);
}

/** Merges `fields` into each element. Pass a `mergeKey` for continuous edits. */
export function updateElements(
  ids: string[],
  fields: Partial<Element> | ((el: Draft<Element>) => void),
  mergeKey?: string,
): void {
  const wanted = new Set(ids);
  change((doc) => {
    for (const el of draftSlide(doc).elements) {
      if (!wanted.has(el.id)) continue;
      if (typeof fields === "function") fields(el);
      else Object.assign(el, fields);
    }
  }, mergeKey);
}

/** Moves unlocked elements by an offset from their positions in `origin`. */
export function moveElements(
  origin: Map<string, { x: number; y: number }>,
  dx: number,
  dy: number,
  mergeKey?: string,
): void {
  change((doc) => {
    for (const el of draftSlide(doc).elements) {
      const o = origin.get(el.id);
      if (!o || el.locked) continue;
      el.x = o.x + dx;
      el.y = o.y + dy;
    }
  }, mergeKey);
}

export function nudgeSelected(dx: number, dy: number): void {
  updateElements(get().selectedIds, (el) => {
    if (el.locked) return;
    el.x += dx;
    el.y += dy;
  });
}

export function deleteSelected(): void {
  const ids = new Set(get().selectedIds);
  if (ids.size === 0) return;
  change((doc) => {
    const slide = draftSlide(doc);
    slide.elements = slide.elements.filter((e) => !ids.has(e.id));
  });
  select([]);
}

let clipboard: Element[] = [];

export function copySelected(): void {
  clipboard = structuredClone(selectedElements(get()));
}

export function cutSelected(): void {
  copySelected();
  deleteSelected();
}

export function paste(offset = 20): void {
  if (clipboard.length === 0) return;
  const copies = clipboard.map((e) => ({ ...e, id: newId(), x: e.x + offset, y: e.y + offset }));
  clipboard = copies.map((e) => structuredClone(e));
  change((doc) => {
    draftSlide(doc).elements.push(...copies);
  });
  select(copies.map((e) => e.id));
}

export function duplicateSelected(): void {
  const saved = clipboard;
  copySelected();
  paste();
  clipboard = saved;
}

export type ZOrder = "forward" | "backward" | "front" | "back";

export function reorderSelected(where: ZOrder): void {
  const ids = new Set(get().selectedIds);
  if (ids.size === 0) return;
  change((doc) => {
    const slide = draftSlide(doc);
    const els = slide.elements;
    const picked = els.filter((e) => ids.has(e.id));
    const rest = els.filter((e) => !ids.has(e.id));
    if (where === "front") slide.elements = [...rest, ...picked];
    else if (where === "back") slide.elements = [...picked, ...rest];
    else if (where === "forward") {
      for (let i = els.length - 2; i >= 0; i--) {
        if (ids.has(els[i].id) && !ids.has(els[i + 1].id))
          [els[i], els[i + 1]] = [els[i + 1], els[i]];
      }
    } else {
      for (let i = 1; i < els.length; i++) {
        if (ids.has(els[i].id) && !ids.has(els[i - 1].id))
          [els[i], els[i - 1]] = [els[i - 1], els[i]];
      }
    }
  });
}

export type Alignment = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

/** Aligns the selection to its own bounds, or to the slide when a single element is selected. */
export function alignSelected(how: Alignment): void {
  const s = get();
  const els = selectedElements(s).filter((e) => !e.locked);
  if (els.length === 0) return;
  const { width, height } = s.doc.page;
  const target =
    s.selectedIds.length === 1 ? { x: 0, y: 0, w: width, h: height } : union(els.map(aabb));
  if (!target) return;
  const offsets = new Map(
    els.map((e) => {
      const b = aabb(e);
      const dx =
        how === "left"
          ? target.x - b.x
          : how === "right"
            ? target.x + target.w - (b.x + b.w)
            : how === "centerX"
              ? target.x + target.w / 2 - (b.x + b.w / 2)
              : 0;
      const dy =
        how === "top"
          ? target.y - b.y
          : how === "bottom"
            ? target.y + target.h - (b.y + b.h)
            : how === "centerY"
              ? target.y + target.h / 2 - (b.y + b.h / 2)
              : 0;
      return [e.id, { dx, dy }];
    }),
  );
  change((doc) => {
    for (const el of draftSlide(doc).elements) {
      const o = offsets.get(el.id);
      if (!o) continue;
      el.x += o.dx;
      el.y += o.dy;
    }
  });
}
