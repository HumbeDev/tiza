import { useTranslation } from "react-i18next";
import type { ShapeKind } from "../document";
import { createShape, createText } from "../document/factory";
import { newPresentation, openPresentation, save, saveAs } from "../files/session";
import {
  addElement,
  addSlide,
  insertMath,
  isDirty,
  redo,
  startEditing,
  undo,
  useEditor,
} from "../store/editor";
import Icon, { type IconName } from "./Icon";
import LanguagePicker from "./LanguagePicker";

const SHAPES: ShapeKind[] = ["rect", "ellipse", "line", "arrow"];

export default function Toolbar() {
  const { t } = useTranslation();
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const dirty = useEditor(isDirty);
  const page = useEditor((s) => s.doc.page);
  const cx = page.width / 2;
  const cy = page.height / 2;

  function insertText() {
    const el = createText(t("canvas.defaultText"), cx, cy);
    addElement(el);
    startEditing(el.id);
  }

  async function insertEquation() {
    startEditing(await insertMath(String.raw`E = mc^2`, cx, cy));
  }

  return (
    <header className="toolbar">
      <span className="brand">{t("app.name")}</span>
      <div className="tool-group">
        <ToolButton
          icon="fileNew"
          label={t("toolbar.new")}
          shortcut="Ctrl+N"
          onClick={newPresentation}
        />
        <ToolButton
          icon="folderOpen"
          label={t("toolbar.open")}
          shortcut="Ctrl+O"
          onClick={openPresentation}
        />
        <ToolButton
          icon="save"
          label={t("toolbar.save")}
          shortcut="Ctrl+S"
          onClick={save}
          badge={dirty}
        />
        <button
          type="button"
          className="tool-button text-only"
          title="Ctrl+Shift+S"
          onClick={saveAs}
        >
          {t("toolbar.saveAs")}
        </button>
      </div>
      <div className="tool-group">
        <ToolButton
          icon="undo"
          label={t("toolbar.undo")}
          shortcut="Ctrl+Z"
          onClick={undo}
          disabled={!canUndo}
        />
        <ToolButton
          icon="redo"
          label={t("toolbar.redo")}
          shortcut="Ctrl+Shift+Z"
          onClick={redo}
          disabled={!canRedo}
        />
      </div>
      <div className="tool-group">
        <ToolButton
          icon="slideAdd"
          label={t("toolbar.newSlide")}
          shortcut="Ctrl+M"
          onClick={addSlide}
          showLabel
        />
      </div>
      <div className="tool-group">
        <ToolButton icon="text" label={t("toolbar.text")} onClick={insertText} showLabel />
        <ToolButton icon="math" label={t("toolbar.equation")} onClick={insertEquation} showLabel />
        {SHAPES.map((shape) => (
          <ToolButton
            key={shape}
            icon={shape}
            label={t(`shapes.${shape}`)}
            onClick={() => addElement(createShape(shape, cx, cy))}
          />
        ))}
      </div>
      <div className="spacer" />
      <LanguagePicker />
    </header>
  );
}

interface ToolButtonProps {
  icon: IconName;
  label: string;
  onClick: () => unknown;
  shortcut?: string;
  disabled?: boolean;
  showLabel?: boolean;
  /** Small dot, e.g. for unsaved changes. */
  badge?: boolean;
}

export function ToolButton({
  icon,
  label,
  onClick,
  shortcut,
  disabled,
  showLabel,
  badge,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className="tool-button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
      {badge && <span className="badge" aria-hidden="true" />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
