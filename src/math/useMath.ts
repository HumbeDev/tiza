import { useState, useSyncExternalStore } from "react";
import { type MathRender, getVersion, renderMathSync, subscribe } from "./mathjax";

export interface MathState {
  /** Latest successful render; kept while the current LaTeX is invalid or loading. */
  render: MathRender | null;
  error: string | null;
}

/** Renders LaTeX, re-rendering when MathJax finishes loading fonts or the preamble changes. */
export function useMath(latex: string, display: boolean): MathState {
  useSyncExternalStore(subscribe, getVersion);
  const [lastGood, setLastGood] = useState<MathRender | null>(null);
  const result = renderMathSync(latex, display);
  if (result?.ok && result.render !== lastGood) setLastGood(result.render);
  return {
    render: result?.ok ? result.render : lastGood,
    error: result && !result.ok ? result.error : null,
  };
}
