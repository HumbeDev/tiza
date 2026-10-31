import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMath } from "../math/useMath";
import { setMathLatex, stopEditing } from "../store/editor";
import CodeEditor from "./CodeEditor";

const VisualMathEditor = lazy(() => import("./VisualMathEditor"));

type Mode = "code" | "visual";

/** Edits one formula. Code and visual modes edit the same LaTeX string. */
export default function MathEditorPanel({ id, latex }: { id: string; latex: string }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("code");
  const { error } = useMath(latex, true);
  const onChange = (value: string) => setMathLatex(id, value, `math:${id}`);

  return (
    <div className="math-editor-panel" role="dialog" aria-label={t("math.editor")}>
      <div className="math-editor-header">
        <div className="tabs" role="tablist">
          {(["code", "visual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? "tab active" : "tab"}
              onClick={() => setMode(m)}
            >
              {t(`math.${m}`)}
            </button>
          ))}
        </div>
        <span className="hint">{t("math.hint")}</span>
        <button type="button" className="small-button primary" onClick={stopEditing}>
          {t("math.done")}
        </button>
      </div>
      {mode === "code" ? (
        <CodeEditor
          language="latex"
          value={latex}
          onChange={onChange}
          onDone={stopEditing}
          placeholderText={t("math.placeholder")}
          autoFocus
        />
      ) : (
        <Suspense fallback={<div className="visual-math-editor" />}>
          <VisualMathEditor value={latex} onChange={onChange} />
        </Suspense>
      )}
      <div className={error ? "math-status error" : "math-status"} role="status">
        {error ? t("math.error", { message: error }) : t("math.ok")}
      </div>
    </div>
  );
}
