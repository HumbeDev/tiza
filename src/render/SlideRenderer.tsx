import { memo } from "react";
import type { Element, Page, Slide } from "../document";
import MathView from "../elements/math/MathView";
import ImageView from "../elements/ImageView";
import ShapeView from "../elements/ShapeView";
import TableView from "../elements/table/TableView";
import VideoView from "../elements/VideoView";
import SimView from "../elements/sim/SimView";
import TextView from "../elements/TextView";

/**
 * edit: the editor canvas · thumb: thumbnails (no live pages) · present: the audience
 * (pages interactive) · preview: presenter view (pages live but not interactive).
 */
export type RenderMode = "edit" | "thumb" | "present" | "preview";

interface Props {
  slide: Slide;
  page: Page;
  mode: RenderMode;
  editingId?: string | null;
  /** Presenting: build step shown; elements of later steps are hidden. */
  step?: number;
}

/** Draws a slide at its logical size; callers scale it with a CSS transform. */
function SlideRenderer({ slide, page, mode, editingId, step }: Props) {
  return (
    <div
      className="slide"
      style={{ width: page.width, height: page.height, background: slide.background ?? "#fff" }}
    >
      {slide.elements.map((el) => (
        <ElementView
          key={el.id}
          el={el}
          mode={mode}
          editing={el.id === editingId}
          pending={step !== undefined && (el.build?.step ?? 0) > step}
        />
      ))}
    </div>
  );
}

interface ElementViewProps {
  el: Element;
  mode: RenderMode;
  editing: boolean;
  /** Not revealed yet (appears on a later click). */
  pending: boolean;
}

function ElementView({ el, mode, editing, pending }: ElementViewProps) {
  const classes = ["element"];
  if (editing && el.kind === "sim") classes.push("interacting");
  if (el.build) classes.push(`build-${el.build.effect}`);
  if (pending) classes.push("build-pending");
  return (
    <div
      className={classes.join(" ")}
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
      ) : el.kind === "image" ? (
        <ImageView el={el} />
      ) : el.kind === "video" ? (
        <VideoView el={el} mode={mode} interactive={editing} />
      ) : el.kind === "table" ? (
        <TableView el={el} mode={mode} editing={editing} />
      ) : (
        <SimView el={el} mode={mode} interactive={editing || mode === "present"} />
      )}
    </div>
  );
}

export default memo(SlideRenderer);
