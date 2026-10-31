import type { Element, MathElement } from "../../document";
import { useMath } from "../../math/useMath";

type Props = { el: Element & { kind: "math" } & MathElement };

/** Display formula stretched to its box (the box always keeps the formula's aspect ratio). */
export default function MathView({ el }: Props) {
  const { render, error } = useMath(el.latex, true);
  if (!render) {
    return (
      <div className="math-view math-error" style={{ fontSize: el.fontSize / 3 }}>
        {error ? el.latex : null}
      </div>
    );
  }
  return (
    <div
      className={error ? "math-view stale" : "math-view"}
      style={{ color: el.color }}
      dangerouslySetInnerHTML={{ __html: render.svg }}
    />
  );
}
