import { useEditorState } from "@tiptap/react";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { create } from "zustand";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type {
  Build,
  BuildEffect,
  Element,
  ImageFit,
  ShapeKind,
  SimFit,
  TableTheme,
  TextAlign,
  TransitionKind,
} from "../document";
import { parseCsv } from "../elements/table/csv";
import { parseEmbedUrl } from "../elements/embed/parse";
import { platform } from "../files/platform";
import { reloadSim } from "../elements/sim/reload";
import {
  type Alignment,
  type ZOrder,
  alignSelected,
  buildOnNextClick,
  currentSlide,
  deleteSelected,
  fitSimBoxToView,
  openHtmlEditor,
  reorderSelected,
  seal,
  selectedElements,
  nextClickStep,
  setBuild,
  setExit,
  setMathFontSize,
  setPreamble,
  setSlideBackground,
  setSlideTransition,
  setTableRows,
  startEditing,
  stopEditing,
  updateElements,
  useEditor,
} from "../store/editor";
import { useActiveTextEditor } from "../elements/text/activeEditor";
import {
  getPreambleError,
  getVersion as getMathVersion,
  subscribe as subscribeMath,
} from "../math/mathjax";
import { useMath } from "../math/useMath";
import Icon, { type IconName } from "./Icon";

const ALIGNMENTS: [Alignment, IconName][] = [
  ["left", "alignLeft"],
  ["centerX", "alignCenterX"],
  ["right", "alignRight"],
  ["top", "alignTop"],
  ["centerY", "alignCenterY"],
  ["bottom", "alignBottom"],
];

const Z_ORDERS: ZOrder[] = ["front", "forward", "backward", "back"];

export default function PropertiesPanel() {
  const { t } = useTranslation();
  const selected = useEditor(useShallow(selectedElements));

  return (
    <aside className="properties" aria-label={t("props.panel")}>
      {selected.length === 0 && <SlideProperties />}
      {selected.length === 1 && <ElementProperties el={selected[0]} />}
      {selected.length > 1 && (
        <p className="hint">{t("props.multiple", { count: selected.length })}</p>
      )}

      {selected.length > 0 && <BuildSection elements={selected} />}

      {selected.length > 0 && (
        <>
          <Section id="props.align" title={t("props.align")}>
            <div className="button-row">
              {ALIGNMENTS.map(([how, icon]) => (
                <IconButton
                  key={how}
                  icon={icon}
                  label={t(`align.${how}`)}
                  onClick={() => alignSelected(how)}
                />
              ))}
            </div>
          </Section>
          <Section id="props.arrange" title={t("props.arrange")}>
            <div className="button-row wrap">
              {Z_ORDERS.map((z) => (
                <button
                  key={z}
                  type="button"
                  className="small-button"
                  onClick={() => reorderSelected(z)}
                >
                  {t(`zorder.${z}`)}
                </button>
              ))}
            </div>
            <button type="button" className="small-button danger" onClick={deleteSelected}>
              <Icon name="trash" /> {t("props.delete")}
            </button>
          </Section>
        </>
      )}
    </aside>
  );
}

function SlideProperties() {
  const { t } = useTranslation();
  const background = useEditor((s) => currentSlide(s).background ?? "#ffffff");
  const slide = useEditor(currentSlide);
  const transition = slide.transition ?? { kind: "none" as const, durationMs: 400 };
  const preamble = useEditor((s) => s.doc.latex.preamble);
  useSyncExternalStore(subscribeMath, getMathVersion);
  const preambleError = getPreambleError();
  return (
    <>
      <Section id="props.slide" title={t("props.slide")}>
        <Field label={t("props.background")}>
          <ColorInput value={background} onChange={setSlideBackground} />
        </Field>
        <Field label={t("present.transition")}>
          <select
            value={transition.kind}
            onChange={(e) =>
              setSlideTransition(slide.id, {
                ...transition,
                kind: e.target.value as TransitionKind,
              })
            }
          >
            {(["none", "fade", "slide"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`present.transitions.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        {transition.kind !== "none" && (
          <NumberField
            label={t("present.duration")}
            value={transition.durationMs}
            min={50}
            max={3000}
            onChange={(durationMs) => setSlideTransition(slide.id, { ...transition, durationMs })}
          />
        )}
        <p className="hint">{t("props.noSelection")}</p>
      </Section>
      <Section id="math.preamble" title={t("math.preamble")}>
        <textarea
          className="code-input"
          rows={5}
          spellCheck={false}
          value={preamble}
          placeholder={String.raw`\newcommand{\R}{\mathbb{R}}`}
          onChange={(e) => setPreamble(e.target.value)}
          onBlur={seal}
        />
        {preambleError ? (
          <p className="hint error">{t("math.error", { message: preambleError })}</p>
        ) : (
          <p className="hint">{t("math.preambleHint")}</p>
        )}
      </Section>
    </>
  );
}

function MathProperties({ el }: { el: Element & { kind: "math" } }) {
  const { t } = useTranslation();
  const { error } = useMath(el.latex, true);
  return (
    <Section id="props.style" title={t("props.style")}>
      <div className="grid-color">
        <NumberField
          label={t("props.fontSize")}
          value={el.fontSize}
          min={4}
          onChange={(size) => setMathFontSize(el.id, size, `prop:${el.id}:fontSize`)}
        />
        <Field label={t("props.color")}>
          <ColorInput
            value={el.color}
            onChange={(color) => updateElements([el.id], { color }, `prop:${el.id}:color`)}
          />
        </Field>
      </div>
      <button type="button" className="small-button" onClick={() => startEditing(el.id)}>
        <Icon name="math" /> {t("math.edit")}
      </button>
      {error && <p className="hint error">{t("math.error", { message: error })}</p>}
      <p className="hint">{t("math.editHint")}</p>
    </Section>
  );
}

const EFFECTS: BuildEffect[] = ["appear", "fade", "rise", "fromLeft", "fromRight", "zoom", "wipe"];

/** Step-by-step reveal when presenting (like Beamer's \pause): entrance and exit. */
function BuildSection({ elements }: { elements: Element[] }) {
  const { t } = useTranslation();
  const ids = elements.map((e) => e.id);
  const pick = (get: (e: Element) => Build | undefined) => {
    const first = get(elements[0]);
    const same = elements.every(
      (e) => get(e)?.step === first?.step && get(e)?.effect === first?.effect,
    );
    return { value: same ? first : undefined, mixed: !same };
  };
  const entrance = pick((e) => e.build);
  const exit = pick((e) => e.exit);

  const row = (
    kind: "in" | "out",
    current: ReturnType<typeof pick>,
    apply: (b: Build | null) => void,
  ) => (
    <div className="grid-build">
      <Field label={t(kind === "in" ? "ribbon.entrance" : "ribbon.exit")}>
        <select
          value={current.mixed ? "mixed" : (current.value?.effect ?? "none")}
          onChange={(e) => {
            const v = e.target.value as BuildEffect | "none";
            apply(
              v === "none" ? null : { step: current.value?.step ?? nextClickStep(), effect: v },
            );
          }}
        >
          {current.mixed && <option value="mixed">—</option>}
          <option value="none">{t("build.none")}</option>
          {EFFECTS.map((fx) => (
            <option key={fx} value={fx}>
              {t(`effects.${kind}.${fx}`)}
            </option>
          ))}
        </select>
      </Field>
      {current.value && (
        <NumberField
          label={t("build.step")}
          value={current.value.step}
          min={1}
          onChange={(step) => apply({ ...current.value!, step: Math.max(1, Math.round(step)) })}
        />
      )}
    </div>
  );

  return (
    <Section id="build" title={t("build.title")}>
      {row("in", entrance, (b) => setBuild(ids, b, `build:${ids.join()}`))}
      {row("out", exit, (b) => setExit(ids, b, `exit:${ids.join()}`))}
      <button type="button" className="small-button" onClick={() => buildOnNextClick()}>
        <Icon name="build" /> {t("build.onNextClick")}
      </button>
      <p className="hint">{t("build.hint")}</p>
    </Section>
  );
}

function VideoProperties({ el }: { el: Element & { kind: "video" } }) {
  const { t } = useTranslation();
  const update = (fields: Partial<Element>, field: string) =>
    updateElements([el.id], fields, `prop:${el.id}:${field}`);
  const optional = (v: number) => (Number.isFinite(v) && v > 0 ? v : undefined);
  return (
    <Section id="video" title={t("props.video")}>
      {(["autoplay", "loop", "muted"] as const).map((k) => (
        <label key={k} className="check">
          <input
            type="checkbox"
            checked={el[k]}
            onChange={(e) => update({ [k]: e.target.checked } as Partial<Element>, k)}
          />
          {t(`video.${k}`)}
        </label>
      ))}
      <div className="grid-2">
        <NumberField
          label={t("video.start")}
          value={el.start ?? 0}
          min={0}
          onChange={(v) => update({ start: optional(v) } as Partial<Element>, "start")}
        />
        <NumberField
          label={t("video.end")}
          value={el.end ?? 0}
          min={0}
          onChange={(v) => update({ end: optional(v) } as Partial<Element>, "end")}
        />
      </div>
      <p className="hint">{t("video.hint")}</p>
    </Section>
  );
}

function EmbedProperties({ el }: { el: Element & { kind: "embed" } }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const update = (fields: Partial<Element>, field: string) =>
    updateElements([el.id], fields, `prop:${el.id}:${field}`);
  const invalid = draft !== null && parseEmbedUrl(draft) === null;
  return (
    <Section id="embed" title={t("embed.content")}>
      <label className="field">
        <span className="field-label">{t("embed.link")}</span>
        <input
          type="url"
          className={invalid ? "text-input invalid" : "text-input"}
          value={draft ?? el.url}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parseEmbedUrl(e.target.value);
            if (parsed)
              update(
                { ...parsed, start: parsed.start, url: e.target.value.trim() } as Partial<Element>,
                "url",
              );
          }}
          onBlur={() => {
            setDraft(null);
            seal();
          }}
        />
      </label>
      {invalid && <p className="hint error">{t("embed.invalid")}</p>}
      {el.provider === "youtube" && (
        <NumberField
          label={t("embed.start")}
          value={el.start ?? 0}
          min={0}
          onChange={(v) =>
            update({ start: v > 0 ? Math.round(v) : undefined } as Partial<Element>, "start")
          }
        />
      )}
      <button type="button" className="small-button" onClick={() => startEditing(el.id)}>
        <Icon name="play" /> {t("sim.interact")}
      </button>
      <p className="hint">{t("embed.online")}</p>
    </Section>
  );
}

const TABLE_THEMES: TableTheme[] = ["green", "blue", "gray", "orange", "purple"];

function TableProperties({ el }: { el: Element & { kind: "table" } }) {
  const { t } = useTranslation();
  const editing = useEditor((s) => s.editingId === el.id);
  const update = (fields: Partial<Element>, field: string) =>
    updateElements([el.id], fields, `prop:${el.id}:${field}`);
  const width = Math.max(1, ...el.rows.map((r) => r.length));
  const grid = el.rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));

  async function importCsv() {
    const file = await platform.pickCsvFile();
    if (file) setTableRows(el.id, parseCsv(file.text));
  }

  return (
    <Section id="table" title={t("props.table")}>
      <div className="button-row wrap">
        <button
          type="button"
          className={editing ? "small-button active" : "small-button"}
          onClick={() => (editing ? stopEditing() : startEditing(el.id))}
        >
          <Icon name="edit" /> {t("table.editCells")}
        </button>
        <button type="button" className="small-button" onClick={importCsv}>
          <Icon name="import" /> {t("table.fromCsv")}
        </button>
      </div>
      <div className="button-row wrap">
        <button
          type="button"
          className="small-button"
          onClick={() => setTableRows(el.id, [...grid, Array(width).fill("")])}
        >
          + {t("table.row")}
        </button>
        <button
          type="button"
          className="small-button"
          onClick={() =>
            setTableRows(
              el.id,
              grid.map((r) => [...r, ""]),
            )
          }
        >
          + {t("table.col")}
        </button>
        <button
          type="button"
          className="small-button"
          disabled={grid.length <= 1}
          onClick={() => setTableRows(el.id, grid.slice(0, -1))}
        >
          − {t("table.row")}
        </button>
        <button
          type="button"
          className="small-button"
          disabled={width <= 1}
          onClick={() =>
            setTableRows(
              el.id,
              grid.map((r) => r.slice(0, -1)),
            )
          }
        >
          − {t("table.col")}
        </button>
      </div>
      <Field label={t("table.theme")}>
        <div className="button-row wrap">
          {TABLE_THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              className={
                el.theme === theme ? `swatch theme-${theme} active` : `swatch theme-${theme}`
              }
              aria-label={t(`table.themes.${theme}`)}
              title={t(`table.themes.${theme}`)}
              onClick={() => update({ theme } as Partial<Element>, "theme")}
            />
          ))}
        </div>
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={el.headerRow}
          onChange={(e) => update({ headerRow: e.target.checked } as Partial<Element>, "header")}
        />
        {t("table.header")}
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={el.striped}
          onChange={(e) => update({ striped: e.target.checked } as Partial<Element>, "striped")}
        />
        {t("table.striped")}
      </label>
      <NumberField
        label={t("props.fontSize")}
        value={el.fontSize}
        min={6}
        onChange={(fontSize) => update({ fontSize } as Partial<Element>, "fontSize")}
      />
      <p className="hint">{t("table.hint", { rows: grid.length, cols: width })}</p>
    </Section>
  );
}

const VIEW_PRESETS: [number, number][] = [
  [800, 600],
  [1024, 768],
  [1120, 630],
  [1280, 720],
  [1920, 1080],
];

function SimProperties({ el }: { el: Element & { kind: "sim" } }) {
  const { t } = useTranslation();
  const interacting = useEditor((s) => s.editingId === el.id);
  const update = (fields: Partial<Element>, field: string) =>
    updateElements([el.id], fields, `prop:${el.id}:${field}`);
  const preset = VIEW_PRESETS.findIndex(([w, h]) => w === el.viewWidth && h === el.viewHeight);

  return (
    <>
      <Section id="sim.content" title={t("sim.content")}>
        <Field label={t("sim.title")}>
          <input
            type="text"
            className="text-input"
            value={el.title}
            onChange={(e) => update({ title: e.target.value } as Partial<Element>, "title")}
            onBlur={seal}
          />
        </Field>
        <div className="button-row">
          <button type="button" className="small-button" onClick={() => openHtmlEditor(el.id)}>
            <Icon name="html" /> {t("sim.editHtml")}
          </button>
          <button
            type="button"
            className={interacting ? "small-button active" : "small-button"}
            onClick={() => (interacting ? stopEditing() : startEditing(el.id))}
          >
            <Icon name="play" /> {t(interacting ? "sim.stopInteracting" : "sim.interact")}
          </button>
          <button type="button" className="small-button" onClick={() => reloadSim(el.id)}>
            <Icon name="reload" /> {t("sim.reload")}
          </button>
        </div>
        <p className="hint">{t("sim.interactHint")}</p>
      </Section>

      <Section id="sim.resolution" title={t("sim.resolution")}>
        <select
          value={preset}
          onChange={(e) => {
            const p = VIEW_PRESETS[Number(e.target.value)];
            if (p) update({ viewWidth: p[0], viewHeight: p[1] } as Partial<Element>, "view");
          }}
        >
          {preset === -1 && <option value={-1}>{t("sim.custom")}</option>}
          {VIEW_PRESETS.map(([w, h], i) => (
            <option key={i} value={i}>
              {w} × {h}
            </option>
          ))}
        </select>
        <div className="grid-2">
          <NumberField
            label={t("props.width")}
            value={el.viewWidth}
            min={50}
            onChange={(viewWidth) => update({ viewWidth } as Partial<Element>, "viewWidth")}
          />
          <NumberField
            label={t("props.height")}
            value={el.viewHeight}
            min={50}
            onChange={(viewHeight) => update({ viewHeight } as Partial<Element>, "viewHeight")}
          />
        </div>
        <div className="button-row">
          <button
            type="button"
            className="small-button"
            onClick={() =>
              update(
                { viewWidth: Math.round(el.w), viewHeight: Math.round(el.h) } as Partial<Element>,
                "view",
              )
            }
          >
            {t("sim.matchBox")}
          </button>
          <button type="button" className="small-button" onClick={() => fitSimBoxToView(el.id)}>
            {t("sim.fitBox")}
          </button>
        </div>
        <Field label={t("sim.fit")}>
          <select
            value={el.fit}
            onChange={(e) => update({ fit: e.target.value as SimFit } as Partial<Element>, "fit")}
          >
            <option value="contain">{t("sim.fitContain")}</option>
            <option value="fill">{t("sim.fitFill")}</option>
          </select>
        </Field>
        <p className="hint">{t("sim.resolutionHint")}</p>
      </Section>

      <Section id="sim.security" title={t("sim.security")}>
        <label className="check">
          <input
            type="checkbox"
            checked={el.allowNetwork}
            onChange={(e) =>
              update({ allowNetwork: e.target.checked } as Partial<Element>, "network")
            }
          />
          {t("sim.allowNetwork")}
        </label>
        <p className="hint">{t("sim.networkHint")}</p>
      </Section>
    </>
  );
}

function AlignButtons({ value, onChange }: { value: TextAlign; onChange: (a: TextAlign) => void }) {
  const { t } = useTranslation();
  return (
    <div className="button-row">
      {(["left", "center", "right"] as TextAlign[]).map((align) => (
        <button
          key={align}
          type="button"
          className={value === align ? "small-button active" : "small-button"}
          onClick={() => onChange(align)}
        >
          {t(`textAlign.${align}`)}
        </button>
      ))}
    </div>
  );
}

const MARKS = [
  { mark: "bold", label: "props.bold", style: { fontWeight: 700 } },
  { mark: "italic", label: "props.italic", style: { fontStyle: "italic" } },
  { mark: "underline", label: "props.underline", style: { textDecoration: "underline" } },
  { mark: "strike", label: "props.strike", style: { textDecoration: "line-through" } },
] as const;

/** Formatting for the text box being edited. Buttons keep the editor focused. */
function TextFormatting() {
  const { t } = useTranslation();
  const editor = useActiveTextEditor((s) => s.editor);
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
          }
        : null,
  });
  if (!editor || !active) return null;
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  function insertFormula() {
    if (!editor) return;
    const pos = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .insertContent({ type: "inlineMath", attrs: { latex: "x^2" } })
      .setNodeSelection(pos)
      .run();
  }

  return (
    <>
      <div className="button-row">
        {MARKS.map(({ mark, label, style }) => (
          <button
            key={mark}
            type="button"
            className={active[mark] ? "small-button active" : "small-button"}
            style={style}
            onMouseDown={keepFocus}
            onClick={() => editor.chain().focus().toggleMark(mark).run()}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="button-row">
        <IconButton
          icon="bulletList"
          label={t("props.bulletList")}
          active={active.bulletList}
          onMouseDown={keepFocus}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <IconButton
          icon="orderedList"
          label={t("props.orderedList")}
          active={active.orderedList}
          onMouseDown={keepFocus}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <IconButton
          icon="inlineMath"
          label={t("math.insertInline")}
          onMouseDown={keepFocus}
          onClick={insertFormula}
        />
      </div>
      <p className="hint">{t("math.inlineHint")}</p>
    </>
  );
}

function ElementProperties({ el }: { el: Element }) {
  const { t } = useTranslation();
  const editing = useEditor((s) => s.editingId === el.id);
  const update = (fields: Partial<Element>, field: string) =>
    updateElements([el.id], fields, `prop:${el.id}:${field}`);

  return (
    <>
      <Section
        id="geometry"
        title={
          el.kind === "shape"
            ? t(`shapes.${el.shape}`)
            : el.kind === "embed"
              ? t(`embed.${el.provider}`)
              : t(`props.${el.kind}`)
        }
      >
        <div className="grid-4">
          <NumberField label="X" value={el.x} onChange={(x) => update({ x }, "x")} />
          <NumberField label="Y" value={el.y} onChange={(y) => update({ y }, "y")} />
          <NumberField
            label={t("props.wShort")}
            title={t("props.width")}
            value={el.w}
            min={1}
            onChange={(w) => update({ w }, "w")}
          />
          <NumberField
            label={t("props.hShort")}
            title={t("props.height")}
            value={el.h}
            min={1}
            onChange={(h) => update({ h }, "h")}
          />
        </div>
        <div className="geometry-row">
          <NumberField
            label={t("props.rotShort")}
            title={t("props.rotation")}
            value={el.rotation}
            onChange={(r) => update({ rotation: ((r % 360) + 360) % 360 }, "rotation")}
          />
          <NumberField
            label={t("props.opacityShort")}
            title={t("props.opacity")}
            value={Math.round(el.opacity * 100)}
            min={0}
            max={100}
            onChange={(o) => update({ opacity: Math.min(1, Math.max(0, o / 100)) }, "opacity")}
          />
          <IconButton
            icon={el.locked ? "lock" : "unlock"}
            label={t(el.locked ? "menu.unlock" : "menu.lock")}
            active={el.locked}
            onClick={() => update({ locked: !el.locked }, "locked")}
          />
        </div>
      </Section>

      {el.kind === "shape" && (
        <Section id="props.style" title={t("props.style")}>
          <Field label={t("props.shape")}>
            <select
              value={el.shape}
              onChange={(e) =>
                update({ shape: e.target.value as ShapeKind } as Partial<Element>, "shape")
              }
            >
              {(["rect", "ellipse", "line", "arrow"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`shapes.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          {(el.shape === "rect" || el.shape === "ellipse") && (
            <Field label={t("props.fill")}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={el.fill !== undefined}
                  onChange={(e) =>
                    update(
                      { fill: e.target.checked ? "#4f8a6b" : undefined } as Partial<Element>,
                      "fill-on",
                    )
                  }
                />
              </label>
              {el.fill !== undefined && (
                <ColorInput
                  value={el.fill}
                  onChange={(fill) => update({ fill } as Partial<Element>, "fill")}
                />
              )}
            </Field>
          )}
          <Field label={t("props.stroke")}>
            <label className="check">
              <input
                type="checkbox"
                checked={el.stroke !== undefined}
                onChange={(e) =>
                  update(
                    {
                      stroke: e.target.checked ? { color: "#1d1d1b", width: 4 } : undefined,
                    } as Partial<Element>,
                    "stroke-on",
                  )
                }
              />
            </label>
            {el.stroke && (
              <>
                <ColorInput
                  value={el.stroke.color}
                  onChange={(color) =>
                    update({ stroke: { ...el.stroke!, color } } as Partial<Element>, "stroke")
                  }
                />
                <NumberField
                  label={t("props.strokeWidth")}
                  value={el.stroke.width}
                  min={0}
                  onChange={(width) =>
                    update({ stroke: { ...el.stroke!, width } } as Partial<Element>, "strokeWidth")
                  }
                />
              </>
            )}
          </Field>
          {el.shape === "rect" && (
            <NumberField
              label={t("props.radius")}
              value={el.radius}
              min={0}
              onChange={(radius) => update({ radius } as Partial<Element>, "radius")}
            />
          )}
        </Section>
      )}

      {el.kind === "text" && (
        <Section id="props.style" title={t("props.style")}>
          <div className="grid-color">
            <NumberField
              label={t("props.fontSize")}
              value={el.fontSize}
              min={4}
              onChange={(fontSize) => update({ fontSize } as Partial<Element>, "fontSize")}
            />
            <Field label={t("props.color")}>
              <ColorInput
                value={el.color}
                onChange={(color) => update({ color } as Partial<Element>, "color")}
              />
            </Field>
          </div>
          <AlignButtons
            value={el.align}
            onChange={(align) => update({ align } as Partial<Element>, "align")}
          />
          {editing ? <TextFormatting /> : <p className="hint">{t("props.editTextHint")}</p>}
        </Section>
      )}

      {el.kind === "math" && <MathProperties el={el} />}
      {el.kind === "sim" && <SimProperties el={el} />}
      {el.kind === "video" && <VideoProperties el={el} />}
      {el.kind === "embed" && <EmbedProperties el={el} />}
      {el.kind === "table" && <TableProperties el={el} />}
      {el.kind === "image" && (
        <Section id="props.style" title={t("props.style")}>
          <Field label={t("image.fit")}>
            <select
              value={el.fit}
              onChange={(e) =>
                update({ fit: e.target.value as ImageFit } as Partial<Element>, "fit")
              }
            >
              {(["contain", "cover", "fill"] as const).map((f) => (
                <option key={f} value={f}>
                  {t(`image.fits.${f}`)}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      )}
    </>
  );
}

const COLLAPSED_KEY = "tiza.collapsedSections";

function readCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Panel sections can be folded; the choice is remembered per section across sessions. */
const useCollapsed = create<{ ids: Set<string> }>(() => ({ ids: readCollapsed() }));

function toggleCollapsed(id: string) {
  const ids = new Set(useCollapsed.getState().ids);
  if (!ids.delete(id)) ids.add(id);
  useCollapsed.setState({ ids });
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Not remembered; fine.
  }
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const collapsed = useCollapsed((s) => s.ids.has(id));
  return (
    <section className={collapsed ? "prop-section collapsed" : "prop-section"}>
      <h2>
        <button type="button" aria-expanded={!collapsed} onClick={() => toggleCollapsed(id)}>
          <Icon name={collapsed ? "chevronRight" : "chevronDown"} small />
          {title}
        </button>
      </h2>
      {!collapsed && children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-controls">{children}</div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  /** Full name shown as a tooltip when `label` is abbreviated. */
  title?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

function NumberField({ label, title, value, onChange, min, max }: NumberFieldProps) {
  return (
    <label className="number-field" title={title}>
      <span className="field-label">{label}</span>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        min={min}
        max={max}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(min !== undefined ? Math.max(min, n) : n);
        }}
        onBlur={seal}
      />
    </label>
  );
}

const HEX = /^#?([0-9a-f]{6})$/i;

/** Swatch + editable HEX code + copy button. */
function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hex = value.toLowerCase();
  return (
    <span className="color-input">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} onBlur={seal} />
      <input
        type="text"
        className="color-hex"
        aria-label={t("color.hex")}
        spellCheck={false}
        maxLength={7}
        value={draft ?? hex}
        onChange={(e) => {
          setDraft(e.target.value);
          const m = HEX.exec(e.target.value.trim());
          if (m) onChange(`#${m[1].toLowerCase()}`);
        }}
        onBlur={() => {
          setDraft(null);
          seal();
        }}
      />
      <button
        type="button"
        className="color-copy"
        title={t(copied ? "color.copied" : "color.copy")}
        aria-label={t("color.copy")}
        onClick={() => {
          void navigator.clipboard.writeText(hex).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        <Icon name={copied ? "check" : "copy"} small />
      </button>
    </span>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  active?: boolean;
}

function IconButton({ icon, label, onClick, onMouseDown, active }: IconButtonProps) {
  return (
    <button
      type="button"
      className={active ? "tool-button active" : "tool-button"}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      <Icon name={icon} />
    </button>
  );
}
