import { useMath } from "../../math/useMath";

/** A formula sized in em, so it scales with the surrounding font size. */
export function InlineMathSvg({ latex }: { latex: string }) {
  const { render, error } = useMath(latex, false);
  if (!render) {
    return <span className={error ? "math-error" : "math-pending"}>{latex || "…"}</span>;
  }
  return (
    <span
      className={error ? "inline-math stale" : "inline-math"}
      title={error ?? undefined}
      style={{
        width: `${render.width}em`,
        height: `${render.height}em`,
        verticalAlign: `${-render.depth}em`,
      }}
      dangerouslySetInnerHTML={{ __html: render.svg }}
    />
  );
}
