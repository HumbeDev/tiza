import { memo } from "react";
import type { Element, Page, Slide } from "../document";
import MathView from "../elements/math/MathView";
import ShapeView from "../elements/ShapeView";
import SimView from "../elements/sim/SimView";
import TextView from "../elements/TextView";

export type RenderMode = "edit" | "thumb";

interface Props {
  slide: Slide;
  page: Page;
  mode: RenderMode;
  editingId?: string | null;
}

/** Draws a slide at its logical size; callers scale it with a CSS transform. */
function SlideRenderer({ slide, page, mode, editingId }: Props) {
  return (
    <div
      className="slide"
      style={{ width: page.width, height: page.height, background: slide.background ?? "#fff" }}
    >
      {slide.elements.map((el) => (
        <ElementView key={el.id} el={el} mode={mode} editing={el.id === editingId} />
      ))}
    </div>
  );
}

function ElementView({ el, mode, editing }: { el: Element; mode: RenderMode; editing: boolean }) {
  return (
    <div
      className={editing && el.kind === "sim" ? "element interacting" : "element"}
      data-element-id={mode === "edit" ? el.id : undefined}
      style={{
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        opacity: el.opacity,
      }}
    >
      {el.kind === "shape" ? (
        <ShapeView el={el} />
      ) : el.kind === "text" ? (
        <TextView el={el} editing={editing} />
      ) : el.kind === "math" ? (
        <MathView el={el} />
      ) : (
        <SimView el={el} mode={mode} interactive={editing} />
      )}
    </div>
  );
}

export default memo(SlideRenderer);
