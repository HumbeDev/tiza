import { useEffect } from "react";
import { newPresentation, openPresentation, save, saveAs } from "../files/session";
import { presentFromEditor } from "../present/startFromEditor";
import { openSettings } from "./SettingsDialog";
import {
  addSlide,
  copySelected,
  deleteSelected,
  groupElements,
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
  ungroupElements,
  useEditor,
} from "../store/editor";
import { pasteData, writeElements } from "./clipboard";

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

      if (e.key === "F5") {
        e.preventDefault();
        void presentFromEditor(e.shiftKey ? "current" : "beginning");
        return;
      }

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

      // Copy/cut/paste: the browser's clipboard events (below) do the work, so the keys
      // aren't cancelled. The internal clipboard is the fallback when no event comes.
      if (mod && (key === "c" || key === "x") && !e.shiftKey && !e.altKey) {
        copySelected();
        if (key === "x") setTimeout(deleteSelected, 0); // after the cut event read it
        return;
      }
      if (mod && key === "v" && !e.shiftKey && !e.altKey) {
        pasteSeen = false;
        setTimeout(() => !pasteSeen && paste(), 60);
        return;
      }

      if (mod && key === "g") groupSelection(e.shiftKey);
      else if (mod && key === "z" && !e.shiftKey) undo();
      else if (mod && (key === "y" || (key === "z" && e.shiftKey))) redo();
      else if (mod && key === "d") duplicateSelected();
      else if (mod && key === "a") selectAll();
      else if (mod && key === "m") addSlide();
      else if (mod && e.code === "BracketRight") reorderSelected(e.shiftKey ? "front" : "forward");
      else if (mod && e.code === "BracketLeft") reorderSelected(e.shiftKey ? "back" : "backward");
      else if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      else if (e.key === "Escape") select([]);
      else if (e.key === "Enter") {
        const sel = selectedElements(useEditor.getState());
        if (
          sel.length === 1 &&
          sel[0].kind !== "shape" &&
          sel[0].kind !== "image" &&
          !sel[0].locked
        ) {
          startEditing(sel[0].id);
        } else handled = false;
      } else if (ARROWS[e.key] && !mod) {
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = ARROWS[e.key];
        if (useEditor.getState().selectedIds.length > 0) nudgeSelected(dx * step, dy * step);
        else handled = false;
      } else handled = false;

      if (handled) e.preventDefault();
    }

    function onCopy(e: ClipboardEvent) {
      if (isTyping(e.target) || !e.clipboardData) return;
      const elements = selectedElements(useEditor.getState());
      if (elements.length === 0) return;
      writeElements(e.clipboardData, elements);
      e.preventDefault();
    }

    function onPaste(e: ClipboardEvent) {
      if (isTyping(e.target) || !e.clipboardData) return;
      pasteSeen = true;
      if (pasteData(e.clipboardData)) e.preventDefault();
      else paste();
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, []);
}

/** Set by the paste event, so the Ctrl+V fallback doesn't paste twice. */
let pasteSeen = false;

/** Ctrl+G groups the selection; Ctrl+Shift+G ungroups it. */
export function groupSelection(ungroup: boolean): void {
  const ids = useEditor.getState().selectedIds;
  if (ungroup) ungroupElements(ids);
  else groupElements(ids);
}
