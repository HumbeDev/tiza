import { useEditorState } from "@tiptap/react";
import { type ReactNode, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { Element, ShapeKind, TextAlign } from "../document";
import {
  type Alignment,
  type ZOrder,
  alignSelected,
  currentSlide,
  deleteSelected,
  reorderSelected,
  seal,
  selectedElements,
  setMathFontSize,
  setPreamble,
  setSlideBackground,
  startEditing,
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

      {selected.length > 0 && (
        <>
          <Section title={t("props.align")}>
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
          <Section title={t("props.arrange")}>
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
  const preamble = useEditor((s) => s.doc.latex.preamble);
  useSyncExternalStore(subscribeMath, getMathVersion);
  const preambleError = getPreambleError();
  return (
    <>
      <Section title={t("props.slide")}>
        <Field label={t("props.background")}>
          <ColorInput value={background} onChange={setSlideBackground} />
        </Field>
        <p className="hint">{t("props.noSelection")}</p>
      </Section>
      <Section title={t("math.preamble")}>
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
    <Section title={t("props.style")}>
      <div className="grid-2">
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
        title={
          el.kind === "shape"
            ? t(`shapes.${el.shape}`)
            : t(el.kind === "text" ? "props.text" : "props.math")
        }
      >
        <div className="grid-2">
          <NumberField label="X" value={el.x} onChange={(x) => update({ x }, "x")} />
          <NumberField label="Y" value={el.y} onChange={(y) => update({ y }, "y")} />
          <NumberField
            label={t("props.width")}
            value={el.w}
            min={1}
            onChange={(w) => update({ w }, "w")}
          />
          <NumberField
            label={t("props.height")}
            value={el.h}
            min={1}
            onChange={(h) => update({ h }, "h")}
          />
          <NumberField
            label={t("props.rotation")}
            value={el.rotation}
            onChange={(r) => update({ rotation: ((r % 360) + 360) % 360 }, "rotation")}
          />
          <NumberField
            label={t("props.opacity")}
            value={Math.round(el.opacity * 100)}
            min={0}
            max={100}
            onChange={(o) => update({ opacity: Math.min(1, Math.max(0, o / 100)) }, "opacity")}
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={el.locked}
            onChange={(e) => update({ locked: e.target.checked }, "locked")}
          />
          {t("props.locked")}
        </label>
      </Section>

      {el.kind === "shape" && (
        <Section title={t("props.style")}>
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
        <Section title={t("props.style")}>
          <div className="grid-2">
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
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="prop-section">
      <h2>{title}</h2>
      {children}
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
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

function NumberField({ label, value, onChange, min, max }: NumberFieldProps) {
  return (
    <label className="number-field">
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

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} onBlur={seal} />
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
