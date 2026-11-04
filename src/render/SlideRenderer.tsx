import { memo } from "react";
import type { Element, Page, Slide } from "../document";
import MathView from "../elements/math/MathView";
import ImageView from "../elements/ImageView";
import ShapeView from "../elements/ShapeView";
import TableView from "../elements/table/TableView";
import VideoView from "../elements/VideoView";
import SimView from "../elements/sim/SimView";
import EmbedView from "../elements/embed/EmbedView";
import TextView from "../elements/TextView";

export type { RenderMode } from "./mode";
import { type RenderMode } from "./mode";

interface Props {
  slide: Slide;
  page: Page;
  mode: RenderMode;
  editingId?: string | null;
  /** Presenting: build step shown; elements of later steps are hidden. */
  step?: number;
  /** The presentation's master slide, drawn behind (unless the slide hides it). */
  master?: Slide;
  /** The design's font (CSS font-family). */
  font?: string;
}

/** Draws a slide at its logical size; callers scale it with a CSS transform. */
function SlideRenderer({ slide, page, mode, editingId, step, master, font }: Props) {
  const behind = master && master.id !== slide.id && !slide.hideMaster ? master.elements : [];
  return (
    <div
      className="slide"
      style={{
        width: page.width,
        height: page.height,
        background: slide.background ?? "#fff",
        fontFamily: font,
      }}
    >
      {behind.map((el) => (
        // Master elements: not selectable from a slide, no build steps.
        <ElementView
          key={`m-${el.id}`}
          el={el}
          mode={mode}
          editing={false}
          pending={false}
          gone={false}
          fromMaster
        />
      ))}
      {slide.elements.map((el) => {
        const pending = step !== undefined && (el.build?.step ?? 0) > step;
        const gone = step !== undefined && el.exit !== undefined && el.exit.step <= step;
        if (mode === "export" && (pending || gone)) return null;
        return (
          <ElementView
            key={el.id}
            el={el}
            mode={mode}
            editing={el.id === editingId}
            pending={pending}
            gone={gone}
          />
        );
      })}
    </div>
  );
}

interface ElementViewProps {
  el: Element;
  mode: RenderMode;
  editing: boolean;
  /** Not revealed yet (appears on a later click). */
  pending: boolean;
  /** Already left (its exit click has passed). */
  gone: boolean;
  fromMaster?: boolean;
}

function ElementView({ el, mode, editing, pending, gone, fromMaster }: ElementViewProps) {
  const classes = fromMaster ? ["element", "from-master"] : ["element"];
  if (editing && (el.kind === "sim" || el.kind === "embed")) classes.push("interacting");
  if (!fromMaster && (mode === "present" || mode === "preview")) {
    if (el.build) classes.push(`in-${el.build.effect}`);
    if (el.exit) classes.push(`out-${el.exit.effect}`);
    if (pending) classes.push("in-pending");
    else if (gone) classes.push("out-done");
  }
  return (
    <div
      className={classes.join(" ")}
      data-element-id={mode === "edit" && !fromMaster ? el.id : undefined}
      data-in={el.build?.step}
      data-out={el.exit?.step}
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
      ) : el.kind === "embed" ? (
        <EmbedView el={el} mode={mode} interactive={editing || mode === "present"} />
      ) : (
        <SimView el={el} mode={mode} interactive={editing || mode === "present"} />
      )}
    </div>
  );
}

export default memo(SlideRenderer);
