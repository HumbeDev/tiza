import { useEffect } from "react";
import { newPresentation, openPresentation, save, saveAs } from "../files/session";
import { openSettings } from "./SettingsDialog";
import {
  addSlide,
  copySelected,
  cutSelected,
  deleteSelected,
  duplicateSelected,
  nudgeSelected,
  paste,
  redo,
  reorderSelected,
  select,
  selectAll,
  selectedElements,
  startEditing,
  undo,
  useEditor,
} from "../store/editor";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Global editor keyboard shortcuts (PROYECTO.md §7.1). */
export function useShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && e.key === ",") {
        e.preventDefault();
        openSettings();
        return;
      }

      // File shortcuts work even while typing.
      if (mod && ["n", "o", "s"].includes(key)) {
        e.preventDefault();
        if (key === "n") void newPresentation();
        else if (key === "o") void openPresentation();
        else void (e.shiftKey ? saveAs() : save());
        return;
      }

      if (isTyping(e.target)) return;
      let handled = true;

      if (mod && key === "z" && !e.shiftKey) undo();
      else if (mod && (key === "y" || (key === "z" && e.shiftKey))) redo();
      else if (mod && key === "c") copySelected();
      else if (mod && key === "x") cutSelected();
      else if (mod && key === "v") paste();
      else if (mod && key === "d") duplicateSelected();
      else if (mod && key === "a") selectAll();
      else if (mod && key === "m") addSlide();
      else if (mod && e.code === "BracketRight") reorderSelected(e.shiftKey ? "front" : "forward");
      else if (mod && e.code === "BracketLeft") reorderSelected(e.shiftKey ? "back" : "backward");
      else if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      else if (e.key === "Escape") select([]);
      else if (e.key === "Enter") {
        const sel = selectedElements(useEditor.getState());
        if (sel.length === 1 && sel[0].kind !== "shape" && !sel[0].locked) startEditing(sel[0].id);
        else handled = false;
      } else if (ARROWS[e.key] && !mod) {
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = ARROWS[e.key];
        if (useEditor.getState().selectedIds.length > 0) nudgeSelected(dx * step, dy * step);
        else handled = false;
      } else handled = false;

      if (handled) e.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
