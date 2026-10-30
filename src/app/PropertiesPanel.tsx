import type { ReactNode } from "react";
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
  setSlideBackground,
  updateElements,
  useEditor,
} from "../store/editor";
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
  return (
    <Section title={t("props.slide")}>
      <Field label={t("props.background")}>
        <ColorInput value={background} onChange={setSlideBackground} />
      </Field>
      <p className="hint">{t("props.noSelection")}</p>
    </Section>
  );
}

function ElementProperties({ el }: { el: Element }) {
  const { t } = useTranslation();
  const update = (fields: Partial<Element>, field: string) =>
    updateElements([el.id], fields, `prop:${el.id}:${field}`);

  return (
    <>
      <Section title={t(el.kind === "text" ? "props.text" : `shapes.${el.shape}`)}>
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
          <div className="button-row">
            {(["left", "center", "right"] as TextAlign[]).map((align) => (
              <button
                key={align}
                type="button"
                className={el.align === align ? "small-button active" : "small-button"}
                onClick={() => update({ align } as Partial<Element>, "align")}
              >
                {t(`textAlign.${align}`)}
              </button>
            ))}
          </div>
          <div className="button-row">
            <button
              type="button"
              className={el.bold ? "small-button active" : "small-button"}
              style={{ fontWeight: 700 }}
              onClick={() => update({ bold: !el.bold } as Partial<Element>, "bold")}
            >
              {t("props.bold")}
            </button>
            <button
              type="button"
              className={el.italic ? "small-button active" : "small-button"}
              style={{ fontStyle: "italic" }}
              onClick={() => update({ italic: !el.italic } as Partial<Element>, "italic")}
            >
              {t("props.italic")}
            </button>
          </div>
          <p className="hint">{t("props.editTextHint")}</p>
        </Section>
      )}
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

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tool-button"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
