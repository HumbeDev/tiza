import { type PointerEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Page, Slide } from "../document";
import SlideRenderer from "../render/SlideRenderer";
import {
  addSlide,
  deleteSlide,
  duplicateSlide,
  moveSlide,
  selectSlide,
  useEditor,
} from "../store/editor";
import Icon from "./Icon";
import { slideMenu } from "./menu/contextMenus";
import { openContextMenu } from "./menu/Menu";
import { ToolButton } from "./Toolbar";

const THUMB_WIDTH = 168;
const DRAG_PX = 4;

export default function SlidePanel() {
  const { t } = useTranslation();
  const slides = useEditor((s) => s.doc.slides);
  const page = useEditor((s) => s.doc.page);
  const currentId = useEditor((s) => s.currentSlideId);
  const templateId = useEditor((s) => s.doc.templateSlideId);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const drag = useRef<{ from: number; startY: number; active: boolean } | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  /** Insertion index (0..=n) for a pointer at clientY. */
  function insertionIndex(clientY: number): number {
    const i = itemRefs.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return clientY < r.top + r.height / 2;
    });
    return i === -1 ? slides.length : i;
  }

  function onPointerDown(e: PointerEvent<HTMLLIElement>, index: number) {
    if (e.button !== 0) return;
    selectSlide(slides[index].id);
    drag.current = { from: index, startY: e.clientY, active: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLLIElement>) {
    const d = drag.current;
    if (!d) return;
    if (!d.active && Math.abs(e.clientY - d.startY) < DRAG_PX) return;
    d.active = true;
    setDropAt(insertionIndex(e.clientY));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d?.active && dropAt !== null) {
      const to = dropAt > d.from ? dropAt - 1 : dropAt;
      moveSlide(d.from, to);
    }
    setDropAt(null);
  }

  return (
    <aside className="slide-panel" aria-label={t("slides.panel")}>
      <ol className="slide-list">
        {slides.map((slide, i) => (
          <li
            key={slide.id}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={[
              "slide-item",
              slide.id === currentId && "current",
              slide.hidden && "hidden-slide",
              dropAt === i && "drop-before",
              dropAt === slides.length && i === slides.length - 1 && "drop-after",
            ]
              .filter(Boolean)
              .join(" ")}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => {
              e.preventDefault();
              selectSlide(slide.id);
              openContextMenu(e, slideMenu(slide.id));
            }}
            aria-current={slide.id === currentId}
          >
            <span className="slide-number">
              {i + 1}
              {slide.hidden && (
                <span title={t("slides.hiddenHint")}>
                  <Icon name="eyeOff" small />
                </span>
              )}
            </span>
            <div className="thumb-wrap">
              <Thumbnail slide={slide} page={page} />
              {slide.id === templateId && (
                <span className="template-badge" title={t("slides.templateHint")}>
                  {t("slides.template")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="slide-actions">
        <ToolButton icon="slideAdd" label={t("toolbar.newSlide")} onClick={addSlide} />
        <ToolButton
          icon="copy"
          label={t("slides.duplicate")}
          onClick={() => duplicateSlide(currentId)}
        />
        <ToolButton
          icon="trash"
          label={t("slides.delete")}
          onClick={() => deleteSlide(currentId)}
          disabled={slides.length <= 1}
        />
      </div>
    </aside>
  );
}

function Thumbnail({ slide, page }: { slide: Slide; page: Page }) {
  const scale = THUMB_WIDTH / page.width;
  return (
    <div className="thumbnail" style={{ width: THUMB_WIDTH, height: page.height * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <SlideRenderer slide={slide} page={page} mode="thumb" />
      </div>
    </div>
  );
}
