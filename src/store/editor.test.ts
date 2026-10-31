import { beforeEach, describe, expect, it } from "vitest";
import { createPresentation, createShape, createText } from "../document/factory";
import {
  addBlankSlide,
  addElement,
  addSlide,
  change,
  currentSlide,
  deleteSelected,
  deleteSlide,
  duplicateSelected,
  duplicateSlide,
  loadDocument,
  moveElements,
  moveSlide,
  redo,
  reorderSelected,
  seal,
  select,
  setSlideNotes,
  setSlideTransition,
  setTemplateSlide,
  undo,
  useEditor,
} from "./editor";

const state = () => useEditor.getState();
const slide = () => currentSlide(state());
const ids = () => slide().elements.map((e) => e.id);

beforeEach(() => loadDocument(createPresentation("Test", "en")));

describe("elements", () => {
  it("adds, selects and undoes/redoes an element", () => {
    const rect = createShape("rect", 500, 500);
    addElement(rect);
    expect(ids()).toEqual([rect.id]);
    expect(state().selectedIds).toEqual([rect.id]);

    undo();
    expect(ids()).toEqual([]);
    expect(state().selectedIds).toEqual([]);

    redo();
    expect(ids()).toEqual([rect.id]);
  });

  it("merges a whole drag into one undo step", () => {
    const rect = createShape("rect", 500, 500);
    addElement(rect);
    const origin = new Map([[rect.id, { x: rect.x, y: rect.y }]]);
    for (let i = 1; i <= 10; i++) moveElements(origin, i * 10, i * 5, "drag-1");
    seal();
    expect(slide().elements[0].x).toBe(rect.x + 100);
    expect(state().past).toHaveLength(2);

    undo();
    expect(slide().elements[0].x).toBe(rect.x);
    expect(slide().elements[0].y).toBe(rect.y);
  });

  it("does not merge across a seal", () => {
    const rect = createShape("rect", 500, 500);
    addElement(rect);
    const origin = new Map([[rect.id, { x: rect.x, y: rect.y }]]);
    moveElements(origin, 10, 0, "drag");
    seal();
    moveElements(origin, 20, 0, "drag");
    seal();
    undo();
    expect(slide().elements[0].x).toBe(rect.x + 10);
  });

  it("does not move locked elements", () => {
    const rect = { ...createShape("rect", 500, 500), locked: true };
    addElement(rect);
    moveElements(new Map([[rect.id, { x: rect.x, y: rect.y }]]), 50, 50);
    expect(slide().elements[0].x).toBe(rect.x);
  });

  it("deletes and restores the selection", () => {
    const a = createShape("rect", 100, 100);
    const b = createText("hi", 200, 200);
    addElement(a);
    addElement(b);
    select([a.id, b.id]);
    deleteSelected();
    expect(ids()).toEqual([]);
    undo();
    expect(ids()).toEqual([a.id, b.id]);
  });

  it("duplicates with new ids and an offset", () => {
    const a = createShape("rect", 100, 100);
    addElement(a);
    duplicateSelected();
    expect(ids()).toHaveLength(2);
    const copy = slide().elements[1];
    expect(copy.id).not.toBe(a.id);
    expect(copy.x).toBe(a.x + 20);
    expect(state().selectedIds).toEqual([copy.id]);
  });

  it("changes z-order", () => {
    const [a, b, c] = [1, 2, 3].map((i) => createShape("rect", i, i));
    [a, b, c].forEach(addElement);
    select([a.id]);
    reorderSelected("forward");
    expect(ids()).toEqual([b.id, a.id, c.id]);
    reorderSelected("front");
    expect(ids()).toEqual([b.id, c.id, a.id]);
    reorderSelected("back");
    expect(ids()).toEqual([a.id, b.id, c.id]);
    select([c.id]);
    reorderSelected("backward");
    expect(ids()).toEqual([a.id, c.id, b.id]);
  });

  it("ignores changes that change nothing", () => {
    change(() => {});
    expect(state().past).toHaveLength(0);
  });
});

describe("slides", () => {
  it("adds a slide after the current one and selects it", () => {
    const first = state().currentSlideId;
    addSlide();
    expect(state().doc.slides).toHaveLength(2);
    expect(state().currentSlideId).not.toBe(first);
    expect(state().doc.slides[1].id).toBe(state().currentSlideId);
  });

  it("never deletes the last slide", () => {
    deleteSlide(state().currentSlideId);
    expect(state().doc.slides).toHaveLength(1);
  });

  it("deletes the current slide, selects a neighbour and undoes", () => {
    addSlide();
    const second = state().currentSlideId;
    deleteSlide(second);
    expect(state().doc.slides).toHaveLength(1);
    expect(state().currentSlideId).toBe(state().doc.slides[0].id);
    undo();
    expect(state().doc.slides.map((s) => s.id)).toContain(second);
  });

  it("duplicates a slide with fresh element ids", () => {
    const a = createShape("rect", 1, 1);
    addElement(a);
    duplicateSlide(state().currentSlideId);
    const [s1, s2] = state().doc.slides;
    expect(s2.id).not.toBe(s1.id);
    expect(s2.elements[0].id).not.toBe(a.id);
    expect(state().currentSlideId).toBe(s2.id);
  });

  it("reorders slides", () => {
    addSlide();
    addSlide();
    const order = state().doc.slides.map((s) => s.id);
    moveSlide(0, 2);
    expect(state().doc.slides.map((s) => s.id)).toEqual([order[1], order[2], order[0]]);
    undo();
    expect(state().doc.slides.map((s) => s.id)).toEqual(order);
  });

  it("undo of adding a slide falls back to an existing slide", () => {
    addSlide();
    undo();
    expect(state().doc.slides).toHaveLength(1);
    expect(state().currentSlideId).toBe(state().doc.slides[0].id);
  });
});

describe("template slide", () => {
  it("copies the template into new slides with fresh ids", () => {
    const logo = createShape("rect", 100, 100);
    addElement(logo);
    const templateId = state().currentSlideId;
    setTemplateSlide(templateId);
    addSlide();
    const added = slide();
    expect(added.id).not.toBe(templateId);
    expect(added.elements).toHaveLength(1);
    expect(added.elements[0].id).not.toBe(logo.id);
    addBlankSlide();
    expect(slide().elements).toHaveLength(0);
  });

  it("forgets the template when its slide is deleted", () => {
    addSlide();
    const id = state().currentSlideId;
    setTemplateSlide(id);
    deleteSlide(id);
    expect(state().doc.templateSlideId).toBeUndefined();
    undo();
    expect(state().doc.templateSlideId).toBe(id);
  });
});

describe("notes and transitions", () => {
  it("merges typing into one undo step", () => {
    const id = state().currentSlideId;
    for (const n of ["H", "Ho", "Hola"]) setSlideNotes(id, n);
    seal();
    expect(slide().notes).toBe("Hola");
    undo();
    expect(slide().notes).toBe("");
  });

  it("removes the transition when set to none", () => {
    const id = state().currentSlideId;
    setSlideTransition(id, { kind: "fade", durationMs: 300 });
    expect(slide().transition?.kind).toBe("fade");
    setSlideTransition(id, { kind: "none", durationMs: 300 });
    expect(slide().transition).toBeUndefined();
  });
});
