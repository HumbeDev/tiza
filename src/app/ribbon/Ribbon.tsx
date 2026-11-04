import { type ReactNode, useEffect, useState } from "react";
import { openEmbedDialog } from "../EmbedDialog";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { BuildEffect, ShapeKind, TransitionKind } from "../../document";
import {
  importPresentation,
  newPresentation,
  openPresentation,
  save,
  saveAs,
  untitled,
} from "../../files/session";
import { presentFromEditor } from "../../present/startFromEditor";
import { getAudienceScreen, setAudienceScreen } from "../../present/client";
import type { Screen } from "../../bindings/Screen";
import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "../../files/platform";
import {
  type Alignment,
  addSlide,
  alignSelected,
  buildOnNextClick,
  copySelected,
  currentSlide,
  cutSelected,
  deleteSelected,
  deleteSlide,
  duplicateSelected,
  duplicateSlide,
  exitOnNextClick,
  hasClipboard,
  isDirty,
  paste,
  redo,
  reorderSelected,
  selectAll,
  selectedElements,
  setBuild,
  setDocTransition,
  setExit,
  setSlideHidden,
  setSlideTransition,
  undo,
  useEditor,
} from "../../store/editor";
import Icon, { type IconName } from "../Icon";
import {
  insertCsvTable,
  insertEmptyTable,
  insertEquation,
  insertHtml,
  insertImage,
  insertShape,
  insertText,
  insertVideo,
} from "../insert";
import { type MenuItem, MenuButton, separator } from "../menu/Menu";
import { THEME_ICONS, openSettings } from "../SettingsDialog";
import { THEMES, setTheme, useTheme } from "../theme";

type Tab = "home" | "insert" | "animations" | "transitions" | "slideshow";
const TABS: Tab[] = ["home", "insert", "animations", "transitions", "slideshow"];
const TAB_KEY = "tiza.ribbonTab";

function storedTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return TABS.includes(v as Tab) ? (v as Tab) : "home";
  } catch {
    return "home";
  }
}

/** Office-style header: quick access + tabs on top, a ribbon of labelled groups below. */
export default function Ribbon() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>(storedTab);
  const dirty = useEditor(isDirty);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const fileName = useEditor((s) => s.file.name);
  const theme = useTheme((s) => s.pref);
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  function choose(next: Tab) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Not remembered.
    }
  }

  const fileMenu = (): MenuItem[] => [
    { label: t("toolbar.new"), icon: "fileNew", shortcut: "Ctrl+N", onSelect: newPresentation },
    {
      label: t("toolbar.open"),
      icon: "folderOpen",
      shortcut: "Ctrl+O",
      onSelect: openPresentation,
    },
    { label: t("toolbar.import"), icon: "import", onSelect: importPresentation },
    separator,
    { label: t("toolbar.save"), icon: "save", shortcut: "Ctrl+S", onSelect: save },
    { label: t("toolbar.saveAs"), shortcut: "Ctrl+Shift+S", onSelect: saveAs },
    separator,
    { label: t("settings.title"), icon: "settings", shortcut: "Ctrl+,", onSelect: openSettings },
  ];

  return (
    <header className="ribbon-header">
      <div className="titlebar">
        <span className="brand">{t("app.name")}</span>
        <div className="file-button">
          <MenuButton label={t("toolbar.file")} items={fileMenu} badge={dirty} />
        </div>
        <div className="quick-access">
          <QuickButton icon="save" label={t("toolbar.save")} shortcut="Ctrl+S" onClick={save} />
          <QuickButton
            icon="undo"
            label={t("toolbar.undo")}
            shortcut="Ctrl+Z"
            onClick={undo}
            disabled={!canUndo}
          />
          <QuickButton
            icon="redo"
            label={t("toolbar.redo")}
            shortcut="Ctrl+Shift+Z"
            onClick={redo}
            disabled={!canRedo}
          />
        </div>
        <nav className="ribbon-tabs" role="tablist" aria-label={t("ribbon.tabs")}>
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "ribbon-tab active" : "ribbon-tab"}
              onClick={() => choose(id)}
            >
              {t(`ribbon.tab.${id}`)}
            </button>
          ))}
        </nav>
        <span className="titlebar-file" title={fileName ?? untitled()}>
          {dirty ? "● " : ""}
          {fileName ?? untitled()}
        </span>
        <QuickButton
          icon={THEME_ICONS[theme]}
          label={`${t("settings.theme")}: ${t(`settings.themes.${theme}`)} → ${t(`settings.themes.${nextTheme}`)}`}
          onClick={() => setTheme(nextTheme)}
        />
        <button
          type="button"
          className="present-cta"
          title="F5"
          onClick={() => void presentFromEditor("beginning")}
        >
          <Icon name="play" /> {t("present.present")}
        </button>
      </div>
      <div className="ribbon" role="tabpanel">
        {tab === "home" && <HomeTab />}
        {tab === "insert" && <InsertTab />}
        {tab === "animations" && <AnimationsTab />}
        {tab === "transitions" && <TransitionsTab />}
        {tab === "slideshow" && <SlideshowTab />}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- building blocks

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="ribbon-group" aria-label={label}>
      <div className="ribbon-group-body">{children}</div>
      <div className="ribbon-group-label">{label}</div>
    </section>
  );
}

interface ButtonProps {
  icon: IconName;
  label: string;
  onClick: () => unknown;
  disabled?: boolean;
  active?: boolean;
  shortcut?: string;
}

function Big({ icon, label, onClick, disabled, active, shortcut }: ButtonProps) {
  return (
    <button
      type="button"
      className={active ? "rb-big active" : "rb-big"}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function Small({ icon, label, onClick, disabled, active, shortcut }: ButtonProps) {
  return (
    <button
      type="button"
      className={active ? "rb-small active" : "rb-small"}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <Icon name={icon} small />
      <span>{label}</span>
    </button>
  );
}

function QuickButton({ icon, label, onClick, disabled, shortcut }: ButtonProps) {
  return (
    <button
      type="button"
      className="quick-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <Icon name={icon} />
    </button>
  );
}

// ---------------------------------------------------------------- tabs

function HomeTab() {
  const { t } = useTranslation();
  const selected = useEditor((s) => s.selectedIds.length);
  const slide = useEditor(currentSlide);
  const slides = useEditor((s) => s.doc.slides.length);
  const none = selected === 0;
  const alignments: [Alignment, IconName][] = [
    ["left", "alignLeft"],
    ["centerX", "alignCenterX"],
    ["right", "alignRight"],
    ["top", "alignTop"],
    ["centerY", "alignCenterY"],
    ["bottom", "alignBottom"],
  ];
  return (
    <>
      <Group label={t("ribbon.clipboard")}>
        <Big
          icon="paste"
          label={t("menu.paste")}
          shortcut="Ctrl+V"
          onClick={() => paste()}
          disabled={!hasClipboard()}
        />
        <div className="rb-column">
          <Small
            icon="cut"
            label={t("menu.cut")}
            shortcut="Ctrl+X"
            onClick={cutSelected}
            disabled={none}
          />
          <Small
            icon="copy"
            label={t("menu.copy")}
            shortcut="Ctrl+C"
            onClick={copySelected}
            disabled={none}
          />
          <Small
            icon="copy"
            label={t("menu.duplicate")}
            shortcut="Ctrl+D"
            onClick={duplicateSelected}
            disabled={none}
          />
        </div>
      </Group>
      <Group label={t("slides.panel")}>
        <Big icon="slideAdd" label={t("toolbar.newSlide")} shortcut="Ctrl+M" onClick={addSlide} />
        <div className="rb-column">
          <Small
            icon="copy"
            label={t("slides.duplicate")}
            onClick={() => duplicateSlide(slide.id)}
          />
          <Small
            icon={slide.hidden ? "eye" : "eyeOff"}
            label={t(slide.hidden ? "slides.show" : "slides.hide")}
            onClick={() => setSlideHidden(slide.id, !slide.hidden)}
          />
          <Small
            icon="trash"
            label={t("slides.delete")}
            onClick={() => deleteSlide(slide.id)}
            disabled={slides <= 1}
          />
        </div>
      </Group>
      <Group label={t("props.arrange")}>
        <div className="rb-column">
          <Small
            icon="front"
            label={t("zorder.front")}
            onClick={() => reorderSelected("front")}
            disabled={none}
          />
          <Small
            icon="arrowUp"
            label={t("zorder.forward")}
            onClick={() => reorderSelected("forward")}
            disabled={none}
          />
          <Small
            icon="arrowDown"
            label={t("zorder.backward")}
            onClick={() => reorderSelected("backward")}
            disabled={none}
          />
        </div>
        <div className="rb-column">
          <Small
            icon="back"
            label={t("zorder.back")}
            onClick={() => reorderSelected("back")}
            disabled={none}
          />
          <Small
            icon="selectAll"
            label={t("menu.selectAll")}
            shortcut="Ctrl+A"
            onClick={selectAll}
          />
          <Small icon="trash" label={t("props.delete")} onClick={deleteSelected} disabled={none} />
        </div>
      </Group>
      <Group label={t("props.align")}>
        <div className="rb-grid-3">
          {alignments.map(([how, icon]) => (
            <button
              key={how}
              type="button"
              className="rb-icon"
              title={t(`align.${how}`)}
              aria-label={t(`align.${how}`)}
              disabled={none}
              onClick={() => alignSelected(how)}
            >
              <Icon name={icon} />
            </button>
          ))}
        </div>
      </Group>
    </>
  );
}

const SHAPES: ShapeKind[] = ["rect", "ellipse", "line", "arrow"];

function InsertTab() {
  const { t } = useTranslation();
  const tableMenu = (): MenuItem[] => [
    { label: t("table.empty"), icon: "table", onSelect: insertEmptyTable },
    { label: t("table.fromCsv"), icon: "import", onSelect: insertCsvTable },
  ];
  const shapeMenu = (): MenuItem[] =>
    SHAPES.map((shape) => ({
      label: t(`shapes.${shape}`),
      icon: shape,
      onSelect: () => insertShape(shape),
    }));
  return (
    <>
      <Group label={t("ribbon.text")}>
        <Big icon="text" label={t("toolbar.text")} onClick={insertText} />
        <Big icon="math" label={t("toolbar.equation")} onClick={insertEquation} />
      </Group>
      <Group label={t("ribbon.media")}>
        <Big icon="image" label={t("toolbar.image")} onClick={insertImage} />
        <Big icon="video" label={t("toolbar.video")} onClick={insertVideo} />
      </Group>
      <Group label={t("ribbon.objects")}>
        <div className="rb-big-menu">
          <MenuButton label={t("toolbar.table")} icon="table" items={tableMenu} />
        </div>
        <div className="rb-big-menu">
          <MenuButton label={t("toolbar.shapes")} icon="shapes" items={shapeMenu} />
        </div>
        <Big icon="html" label={t("toolbar.html")} onClick={insertHtml} />
      </Group>
      <Group label={t("ribbon.web")}>
        <Big icon="youtube" label={t("embed.youtubeShort")} onClick={openEmbedDialog} />
        <Big icon="xPost" label={t("embed.xShort")} onClick={openEmbedDialog} />
      </Group>
      <Group label={t("ribbon.import")}>
        <Big icon="import" label={t("ribbon.importFile")} onClick={importPresentation} />
      </Group>
    </>
  );
}

const EFFECTS: [BuildEffect, IconName][] = [
  ["appear", "fxAppear"],
  ["fade", "fxFade"],
  ["rise", "fxRise"],
  ["fromLeft", "fxFromLeft"],
  ["fromRight", "fxFromRight"],
  ["zoom", "fxZoom"],
  ["wipe", "fxWipe"],
];

function AnimationsTab() {
  const { t } = useTranslation();
  const selected = useEditor(useShallow(selectedElements));
  const ids = selected.map((e) => e.id);
  const none = ids.length === 0;
  const entrance =
    selected.length && selected.every((e) => e.build?.effect === selected[0].build?.effect)
      ? selected[0].build
      : undefined;
  const exit =
    selected.length && selected.every((e) => e.exit?.effect === selected[0].exit?.effect)
      ? selected[0].exit
      : undefined;

  // A new effect goes on the next click; changing the effect of an animated element keeps its click.
  const setEntrance = (effect: BuildEffect) =>
    entrance ? setBuild(ids, { ...entrance, effect }) : buildOnNextClick(effect);
  const setLeave = (effect: BuildEffect) =>
    exit ? setExit(ids, { ...exit, effect }) : exitOnNextClick(effect);

  return (
    <>
      <Group label={t("ribbon.entrance")}>
        <div className="rb-gallery">
          {EFFECTS.map(([effect, icon]) => (
            <GalleryTile
              key={effect}
              icon={icon}
              label={t(`effects.in.${effect}`)}
              active={entrance?.effect === effect}
              disabled={none}
              onClick={() => setEntrance(effect)}
            />
          ))}
        </div>
      </Group>
      <Group label={t("ribbon.exit")}>
        <div className="rb-gallery">
          {EFFECTS.map(([effect, icon]) => (
            <GalleryTile
              key={effect}
              icon={icon}
              label={t(`effects.out.${effect}`)}
              active={exit?.effect === effect}
              disabled={none}
              onClick={() => setLeave(effect)}
            />
          ))}
        </div>
      </Group>
      <Group label={t("ribbon.timing")}>
        <div className="rb-column">
          <StepField
            label={t("ribbon.appearsOn")}
            value={entrance?.step}
            disabled={!entrance}
            onChange={(step) => entrance && setBuild(ids, { ...entrance, step })}
          />
          <StepField
            label={t("ribbon.leavesOn")}
            value={exit?.step}
            disabled={!exit}
            onChange={(step) => exit && setExit(ids, { ...exit, step })}
          />
        </div>
        <div className="rb-column">
          <Small
            icon="trash"
            label={t("ribbon.removeEntrance")}
            disabled={!selected.some((e) => e.build)}
            onClick={() => setBuild(ids, null)}
          />
          <Small
            icon="trash"
            label={t("ribbon.removeExit")}
            disabled={!selected.some((e) => e.exit)}
            onClick={() => setExit(ids, null)}
          />
        </div>
      </Group>
      {none && <p className="ribbon-hint">{t("ribbon.selectToAnimate")}</p>}
    </>
  );
}

function StepField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value?: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="rb-field">
      <span>{label}</span>
      <input
        type="number"
        min={1}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const n = Math.round(e.target.valueAsNumber);
          if (n >= 1) onChange(n);
        }}
      />
    </label>
  );
}

function GalleryTile({ icon, label, active, disabled, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      className={active ? "rb-tile active" : "rb-tile"}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-pressed={active}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

const TRANSITIONS: [TransitionKind, IconName][] = [
  ["none", "trNone"],
  ["fade", "fxFade"],
  ["slide", "trSlide"],
  ["zoom", "fxZoom"],
  ["rise", "fxRise"],
];

function TransitionsTab() {
  const { t } = useTranslation();
  const slide = useEditor(currentSlide);
  const fileDefault = useEditor((s) => s.doc.transition);
  const effective = slide.transition ?? fileDefault ?? { kind: "none" as const, durationMs: 500 };
  const inherited = !slide.transition;

  return (
    <>
      <Group label={t("ribbon.thisSlide")}>
        <div className="rb-gallery">
          {TRANSITIONS.map(([kind, icon]) => (
            <GalleryTile
              key={kind}
              icon={icon}
              label={t(`present.transitions.${kind}`)}
              active={effective.kind === kind}
              onClick={() =>
                setSlideTransition(
                  slide.id,
                  kind === "none" && !fileDefault
                    ? null
                    : { kind, durationMs: effective.durationMs },
                )
              }
            />
          ))}
        </div>
      </Group>
      <Group label={t("ribbon.timing")}>
        <div className="rb-column">
          <label className="rb-field">
            <span>{t("present.duration")}</span>
            <input
              type="number"
              min={100}
              max={3000}
              step={50}
              value={effective.durationMs}
              disabled={effective.kind === "none"}
              onChange={(e) => {
                const ms = Math.round(e.target.valueAsNumber);
                if (ms >= 50)
                  setSlideTransition(slide.id, { kind: effective.kind, durationMs: ms });
              }}
            />
          </label>
          {inherited && fileDefault && <span className="ribbon-note">{t("ribbon.fromFile")}</span>}
        </div>
      </Group>
      <Group label={t("ribbon.wholeFile")}>
        <Big
          icon="check"
          label={t("ribbon.applyToAll")}
          onClick={() => setDocTransition(effective.kind === "none" ? null : effective, true)}
        />
        <div className="rb-column">
          <span className="ribbon-note">
            {t("ribbon.fileDefault")}:{" "}
            <strong>{t(`present.transitions.${fileDefault?.kind ?? "none"}`)}</strong>
          </span>
          <span className="ribbon-note">{t("ribbon.fileDefaultHint")}</span>
        </div>
      </Group>
    </>
  );
}

/** Where the audience sees the slides; the presenter view goes to another screen. */
function ScreensGroup() {
  const { t } = useTranslation();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [chosen, setChosen] = useState(getAudienceScreen);
  const refresh = () => void invoke<Screen[]>("list_screens").then(setScreens, () => {});
  useEffect(refresh, []);
  const label = (s: Screen) =>
    `${/^(eDP|LVDS|DSI)/.test(s.name) ? t("present.laptopScreen") : s.name} · ${Math.round(s.width)}×${Math.round(s.height)}`;
  const missing = chosen !== null && !screens.some((s) => s.name === chosen);
  return (
    <Group label={t("present.screens")}>
      <div className="rb-screens">
        <label className="rb-field wide">
          <span>{t("present.audienceScreen")}</span>
          <select
            value={chosen ?? ""}
            onPointerDown={refresh}
            onChange={(e) => {
              const name = e.target.value || null;
              setChosen(name);
              setAudienceScreen(name);
            }}
          >
            <option value="">{t("present.autoScreen")}</option>
            {screens.map((s) => (
              <option key={s.name} value={s.name}>
                {label(s)}
              </option>
            ))}
            {missing && <option value={chosen}>{chosen}</option>}
          </select>
        </label>
        <p className="ribbon-note">
          {screens.length > 1 ? t("present.twoScreensHint") : t("present.oneScreenHint")}
        </p>
      </div>
    </Group>
  );
}

function SlideshowTab() {
  const { t } = useTranslation();
  return (
    <>
      <Group label={t("ribbon.start")}>
        <Big
          icon="play"
          label={t("present.fromBeginning")}
          shortcut="F5"
          onClick={() => presentFromEditor("beginning")}
        />
        <Big
          icon="play"
          label={t("present.fromCurrent")}
          shortcut="Shift+F5"
          onClick={() => presentFromEditor("current")}
        />
      </Group>
      {isDesktop && <ScreensGroup />}
      <Group label={t("ribbon.practice")}>
        <Big
          icon="monitor"
          label={t("present.rehearse")}
          onClick={() => presentFromEditor("current", true)}
        />
      </Group>
      <Group label={t("settings.title")}>
        <Big icon="settings" label={t("settings.title")} onClick={() => openSettings()} />
      </Group>
    </>
  );
}
