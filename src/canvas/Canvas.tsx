import { type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import type { Element } from "../document";
import {
  type Box,
  type Handle,
  type Point,
  type Rect,
  aabb,
  intersects,
  normalizeRect,
  resizeBox,
  rotationTowards,
  snapMove,
  union,
} from "../document/geometry";
import SlideRenderer from "../render/SlideRenderer";
import {
  currentSlide,
  moveElements,
  seal,
  select,
  startEditing,
  stopEditing,
  toggleSelected,
  updateElements,
  useEditor,
} from "../store/editor";
import { canvasMenu, elementMenu } from "../app/menu/contextMenus";
import { openContextMenu } from "../app/menu/Menu";
import SelectionOverlay, { type Guides } from "./SelectionOverlay";

const PADDING = 32;
/** Snap distance in screen pixels. */
const SNAP_PX = 8;
/** Pointer travel in screen pixels before a press becomes a drag. */
const DRAG_PX = 3;

type Gesture =
  | {
      kind: "move";
      start: Point;
      origin: Map<string, { x: number; y: number }>;
      bounds: Rect;
      targets: Rect[];
      moved: boolean;
      collapseTo: string | null;
    }
  | { kind: "marquee"; start: Point; base: string[] }
  | { kind: "resize"; el: Element; box: Box; handle: Handle; moved: boolean }
  | { kind: "rotate"; id: string; box: Box; moved: boolean };

let gestureCounter = 0;

export default function Canvas() {
  const page = useEditor((s) => s.doc.page);
  const master = useEditor((s) => s.doc.master);
  const font = useEditor((s) => s.doc.theme?.font);
  const slide = useEditor(currentSlide);
  const editingId = useEditor((s) => s.editingId);

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const gesture = useRef<Gesture | null>(null);
  const gestureKey = useRef("");
  const [guides, setGuides] = useState<Guides | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = Math.max(
    0.05,
    Math.min((size.w - PADDING * 2) / page.width, (size.h - PADDING * 2) / page.height),
  );

  function toSlide(e: { clientX: number; clientY: number }): Point {
    const r = stageRef.current?.getBoundingClientRect();
    return r ? { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale } : { x: 0, y: 0 };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const p = toSlide(e);
    const state = useEditor.getState();
    const els = currentSlide(state).elements;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    gestureKey.current = `gesture-${++gestureCounter}`;

    const handleEl = target.closest<HTMLElement>("[data-handle]");
    const elementEl = target.closest<HTMLElement>("[data-element-id]");

    if (state.editingId && elementEl?.dataset.elementId !== state.editingId) stopEditing();

    if (handleEl && state.selectedIds.length === 1) {
      const el = els.find((x) => x.id === state.selectedIds[0]);
      if (!el) return;
      const box = toBox(el);
      const h = handleEl.dataset.handle!;
      if (h === "rotate") gesture.current = { kind: "rotate", id: el.id, box, moved: false };
      else {
        const [x, y] = h.split(",").map(Number) as [Handle["x"], Handle["y"]];
        gesture.current = { kind: "resize", el, box, handle: { x, y }, moved: false };
      }
    } else if (elementEl) {
      const id = elementEl.dataset.elementId!;
      if (id === state.editingId) return;
      const wasSelected = state.selectedIds.includes(id);
      if (additive) toggleSelected(id);
      // Alt+click: one element inside a group.
      else if (e.altKey) select([id], true);
      else if (!wasSelected) select([id]);
      const selected = new Set(useEditor.getState().selectedIds);
      if (!selected.has(id)) return;
      const moving = els.filter((x) => selected.has(x.id));
      gesture.current = {
        kind: "move",
        start: p,
        origin: new Map(moving.filter((x) => !x.locked).map((x) => [x.id, { x: x.x, y: x.y }])),
        bounds: union(moving.map(aabb))!,
        targets: [
          { x: 0, y: 0, w: page.width, h: page.height },
          ...els.filter((x) => !selected.has(x.id)).map(aabb),
        ],
        moved: false,
        collapseTo: !additive && wasSelected && selected.size > 1 ? id : null,
      };
    } else {
      const base = additive ? state.selectedIds : [];
      if (!additive) select([]);
      gesture.current = { kind: "marquee", start: p, base };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const p = toSlide(e);
    const key = gestureKey.current;

    if (g.kind === "move") {
      const dx = p.x - g.start.x;
      const dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) * scale < DRAG_PX) return;
      g.moved = true;
      if (g.origin.size === 0) return;
      const snapped = e.altKey
        ? { dx, dy, guidesX: [], guidesY: [] }
        : snapMove(g.bounds, dx, dy, g.targets, SNAP_PX / scale);
      moveElements(g.origin, snapped.dx, snapped.dy, key);
      setGuides({ x: snapped.guidesX, y: snapped.guidesY });
    } else if (g.kind === "marquee") {
      const rect = normalizeRect(g.start, p);
      setMarquee(rect);
      const hits = currentSlide(useEditor.getState())
        .elements.filter((el) => intersects(aabb(el), rect))
        .map((el) => el.id);
      select([...new Set([...g.base, ...hits])]);
    } else if (g.kind === "resize") {
      g.moved = true;
      // Formulas always keep their aspect ratio; resizing scales the font.
      const isMath = g.el.kind === "math";
      const b = resizeBox(g.box, g.handle, p, e.shiftKey || isMath);
      updateElements(
        [g.el.id],
        (el) => {
          Object.assign(el, { x: b.x, y: b.y, w: b.w, h: b.h });
          if (el.kind === "math" && g.el.kind === "math")
            el.fontSize = (g.el.fontSize * b.h) / g.box.h;
        },
        key,
      );
    } else {
      g.moved = true;
      updateElements([g.id], { rotation: rotationTowards(g.box, p, e.shiftKey ? 15 : null) }, key);
    }
  }

  function onPointerUp() {
    const g = gesture.current;
    gesture.current = null;
    seal();
    setGuides(null);
    setMarquee(null);
    if (g?.kind === "move" && !g.moved && g.collapseTo) select([g.collapseTo]);
  }

  function onDoubleClick(e: React.MouseEvent) {
    // Pointer capture retargets the click to the viewport: find what is under the cursor.
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const id = hit?.closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
    const el = id && currentSlide(useEditor.getState()).elements.find((x) => x.id === id);
    if (el && el.kind !== "shape" && el.kind !== "image" && !el.locked) startEditing(el.id);
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const id = hit?.closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
    if (!id) {
      select([]);
      openContextMenu(e, canvasMenu());
      return;
    }
    if (!useEditor.getState().selectedIds.includes(id)) select([id]);
    openContextMenu(e, elementMenu());
  }

  return (
    <div
      ref={viewportRef}
      onContextMenu={onContextMenu}
      className="canvas-viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="canvas-stage"
        ref={stageRef}
        style={{ width: page.width * scale, height: page.height * scale }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <SlideRenderer
            slide={slide}
            page={page}
            mode="edit"
            editingId={editingId}
            master={master}
            font={font}
          />
          <SelectionOverlay scale={scale} guides={guides} marquee={marquee} />
        </div>
      </div>
    </div>
  );
}

const toBox = (el: Element): Box => ({ x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation });
