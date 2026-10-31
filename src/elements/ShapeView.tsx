import type { Element, ShapeElement } from "../document";

type Props = { el: Element & { kind: "shape" } & ShapeElement };

export default function ShapeView({ el }: Props) {
  const { w, h, fill, stroke, shape } = el;
  const sw = stroke?.width ?? 0;
  const strokeProps = stroke ? { stroke: stroke.color, strokeWidth: sw } : { stroke: "none" };

  let body;
  if (shape === "rect") {
    body = (
      <rect
        x={sw / 2}
        y={sw / 2}
        width={Math.max(0, w - sw)}
        height={Math.max(0, h - sw)}
        rx={el.radius}
        fill={fill ?? "none"}
        {...strokeProps}
      />
    );
  } else if (shape === "ellipse") {
    body = (
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={Math.max(0, (w - sw) / 2)}
        ry={Math.max(0, (h - sw) / 2)}
        fill={fill ?? "none"}
        {...strokeProps}
      />
    );
  } else {
    const color = stroke?.color ?? fill ?? "#000";
    const width = Math.max(1, sw);
    const head = shape === "arrow" ? Math.min(w / 2, Math.max(16, width * 3.5)) : 0;
    body = (
      <>
        <line
          x1={0}
          y1={h / 2}
          x2={w - head * 0.9}
          y2={h / 2}
          stroke={color}
          strokeWidth={width}
          strokeLinecap={head ? "butt" : "round"}
        />
        {head > 0 && (
          <polygon
            points={`${w},${h / 2} ${w - head},${h / 2 - head * 0.6} ${w - head},${h / 2 + head * 0.6}`}
            fill={color}
          />
        )}
      </>
    );
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {body}
    </svg>
  );
}
