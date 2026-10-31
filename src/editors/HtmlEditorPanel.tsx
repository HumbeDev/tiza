import { useTranslation } from "react-i18next";
import { reloadSim } from "../elements/sim/reload";
import { showFileError } from "../files/session";
import { platform } from "../files/platform";
import { closeHtmlEditor, setSimHtml, updateElements } from "../store/editor";
import CodeEditor from "./CodeEditor";

/** Edits the HTML of one simulation; the slide updates as you type. */
export default function HtmlEditorPanel({ id, html }: { id: string; html: string }) {
  const { t } = useTranslation();

  async function loadFile() {
    try {
      const file = await platform.pickHtmlFile();
      if (!file) return;
      setSimHtml(id, file.text);
      updateElements([id], { title: file.name.replace(/\.html?$/i, "") });
    } catch (e) {
      await showFileError(e);
    }
  }

  return (
    <div className="math-editor-panel html-editor-panel" role="dialog" aria-label={t("sim.editor")}>
      <div className="math-editor-header">
        <strong>{t("sim.editor")}</strong>
        <span className="hint">{t("sim.editorHint")}</span>
        <button type="button" className="small-button" onClick={loadFile}>
          {t("sim.loadFile")}
        </button>
        <button type="button" className="small-button" onClick={() => reloadSim(id)}>
          ↺ {t("sim.reload")}
        </button>
        <button type="button" className="small-button primary" onClick={closeHtmlEditor}>
          {t("math.done")}
        </button>
      </div>
      <CodeEditor
        key={id}
        language="html"
        value={html}
        onChange={(value) => setSimHtml(id, value, `html:${id}`)}
        onDone={closeHtmlEditor}
        autoFocus
      />
    </div>
  );
}
