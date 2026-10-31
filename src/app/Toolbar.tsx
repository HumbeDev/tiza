import { useTranslation } from "react-i18next";
import type { ShapeKind } from "../document";
import { createShape, createSim, createText } from "../document/factory";
import pendulum from "../../examples/pendulo.html?raw";
import { newPresentation, openPresentation, save, saveAs } from "../files/session";
import {
  addElement,
  addSlide,
  insertMath,
  isDirty,
  openHtmlEditor,
  redo,
  startEditing,
  undo,
  useEditor,
} from "../store/editor";
import Icon, { type IconName } from "./Icon";
import { type MenuItem, MenuButton, separator } from "./menu/Menu";
import { THEME_ICONS, openSettings } from "./SettingsDialog";
import { THEMES, setTheme, useTheme } from "./theme";

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

  function insertHtml() {
    const el = createSim(pendulum, t("sim.exampleTitle"), cx, cy);
    addElement(el);
    openHtmlEditor(el.id);
  }

  const theme = useTheme((s) => s.pref);
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  const fileMenu = (): MenuItem[] => [
    { label: t("toolbar.new"), icon: "fileNew", shortcut: "Ctrl+N", onSelect: newPresentation },
    {
      label: t("toolbar.open"),
      icon: "folderOpen",
      shortcut: "Ctrl+O",
      onSelect: openPresentation,
    },
    separator,
    { label: t("toolbar.save"), icon: "save", shortcut: "Ctrl+S", onSelect: save },
    { label: t("toolbar.saveAs"), shortcut: "Ctrl+Shift+S", onSelect: saveAs },
    separator,
    { label: t("settings.title"), icon: "settings", shortcut: "Ctrl+,", onSelect: openSettings },
  ];

  const shapeMenu = (): MenuItem[] =>
    SHAPES.map((shape) => ({
      label: t(`shapes.${shape}`),
      icon: shape,
      onSelect: () => addElement(createShape(shape, cx, cy)),
    }));

  return (
    <header className="toolbar">
      <span className="brand">{t("app.name")}</span>
      <MenuButton label={t("toolbar.file")} items={fileMenu} badge={dirty} />
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
      <div className="tool-group insert-group" role="group" aria-label={t("toolbar.insert")}>
        <span className="group-label">{t("toolbar.insert")}</span>
        <ToolButton icon="text" label={t("toolbar.text")} onClick={insertText} showLabel />
        <ToolButton icon="math" label={t("toolbar.equation")} onClick={insertEquation} showLabel />
        <ToolButton icon="html" label={t("toolbar.html")} onClick={insertHtml} showLabel />
        <MenuButton label={t("toolbar.shapes")} icon="shapes" items={shapeMenu} />
      </div>
      <div className="spacer" />
      <ToolButton
        icon={THEME_ICONS[theme]}
        label={`${t("settings.theme")}: ${t(`settings.themes.${theme}`)} → ${t(`settings.themes.${nextTheme}`)}`}
        onClick={() => setTheme(nextTheme)}
      />
      <ToolButton
        icon="settings"
        label={t("settings.title")}
        shortcut="Ctrl+,"
        onClick={openSettings}
      />
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
