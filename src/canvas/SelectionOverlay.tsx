import { useShallow } from "zustand/react/shallow";
import type { Element } from "../document";
import type { Rect } from "../document/geometry";
import { currentSlide, selectedElements, useEditor } from "../store/editor";

export interface Guides {
  x: number[];
  y: number[];
}

interface Props {
  scale: number;
  guides: Guides | null;
  marquee: Rect | null;
}

const HANDLES: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const CURSORS: Record<string, string> = {
  "-1,-1": "nwse-resize",
  "1,1": "nwse-resize",
  "1,-1": "nesw-resize",
  "-1,1": "nesw-resize",
  "0,-1": "ns-resize",
  "0,1": "ns-resize",
  "-1,0": "ew-resize",
  "1,0": "ew-resize",
};

export default function SelectionOverlay({ scale, guides, marquee }: Props) {
  const page = useEditor((s) => s.doc.page);
  const selected = useEditor(useShallow(selectedElements));
  const editingId = useEditor((s) => s.editingId);
  const elements = useEditor((s) => currentSlide(s).elements);
  const px = 1 / scale;
  const single =
    selected.length === 1 && !selected[0].locked && editingId === null ? selected[0] : null;

  return (
    <div className="overlay" style={{ width: page.width, height: page.height }}>
      {elements
        .filter((el) => el.build)
        .map((el) => (
          <div
            key={`b${el.id}`}
            className="build-badge"
            style={{
              left: el.x - 12 * px,
              top: el.y - 12 * px,
              width: 24 * px,
              height: 24 * px,
              fontSize: 13 * px,
            }}
          >
            {el.build!.step}
          </div>
        ))}
      {selected.map((el) => (
        <div
          key={el.id}
          className={el.locked ? "outline locked" : "outline"}
          style={{ ...boxStyle(el), outlineWidth: 1.5 * px }}
        />
      ))}

      {single && (
        <div className="handles" style={boxStyle(single)}>
          <div className="rotate-stem" style={{ height: 28 * px, width: px, top: -28 * px }} />
          <div
            className="handle rotate"
            data-handle="rotate"
            style={{
              width: 14 * px,
              height: 14 * px,
              top: -35 * px,
              left: `calc(50% - ${7 * px}px)`,
              borderWidth: 1.5 * px,
            }}
          />
          {HANDLES.map(([hx, hy]) => (
            <div
              key={`${hx},${hy}`}
              className="handle"
              data-handle={`${hx},${hy}`}
              style={{
                width: 10 * px,
                height: 10 * px,
                borderWidth: 1.5 * px,
                left: `calc(${(hx + 1) * 50}% - ${5 * px}px)`,
                top: `calc(${(hy + 1) * 50}% - ${5 * px}px)`,
                cursor: CURSORS[`${hx},${hy}`],
              }}
            />
          ))}
        </div>
      )}

      {guides?.x.map((x) => (
        <div
          key={`gx${x}`}
          className="guide"
          style={{ left: x, top: 0, width: px, height: page.height }}
        />
      ))}
      {guides?.y.map((y) => (
        <div
          key={`gy${y}`}
          className="guide"
          style={{ top: y, left: 0, height: px, width: page.width }}
        />
      ))}

      {marquee && (
        <div
          className="marquee"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
            borderWidth: px,
          }}
        />
      )}
    </div>
  );
}

function boxStyle(el: Element) {
  return {
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  };
}
