import { useState } from "react";
import { useTranslation } from "react-i18next";
import { currentSlide, seal, setSlideNotes, useEditor } from "../store/editor";
import Icon from "./Icon";

const OPEN_KEY = "tiza.notesOpen";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Speaker notes of the current slide, shown in the presenter view. */
export default function NotesPanel() {
  const { t } = useTranslation();
  const slide = useEditor(currentSlide);
  const [open, setOpen] = useState(readOpen);

  function toggle() {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "0" : "1");
    } catch {
      // Not remembered.
    }
  }

  return (
    <section className={open ? "notes-panel" : "notes-panel collapsed"}>
      <button type="button" className="notes-toggle" aria-expanded={open} onClick={toggle}>
        <Icon name={open ? "chevronDown" : "chevronRight"} small />
        {t("notes.title")}
        {!open && slide.notes.trim() && (
          <span className="notes-preview">{slide.notes.split("\n")[0]}</span>
        )}
      </button>
      {open && (
        <textarea
          key={slide.id}
          value={slide.notes}
          placeholder={t("notes.placeholder")}
          aria-label={t("notes.title")}
          onChange={(e) => setSlideNotes(slide.id, e.target.value)}
          onBlur={seal}
        />
      )}
    </section>
  );
}
