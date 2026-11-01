// New / open / save / save as, autosave with crash recovery, window title and close guard.
import { invoke } from "@tauri-apps/api/core";
import type { Presentation } from "../document";
import { createPresentation } from "../document/factory";
import i18n from "../i18n";
import {
  type EditorState,
  isDirty,
  loadDocument,
  markSaved,
  markUnsaved,
  useEditor,
} from "../store/editor";
import { type FileError, toFileError } from "./format";
import { isDesktop, platform } from "./platform";

const AUTOSAVE_MS = 15_000;
const t = i18n.t.bind(i18n);
const state = useEditor.getState;

export const untitled = (): string => t("file.untitled");

function suggestedName(s: EditorState): string {
  const base = s.file.name ?? (s.doc.meta.title.trim() || untitled());
  return /\.tiza$/i.test(base) ? base : `${base}.tiza`;
}

export async function showFileError(e: unknown): Promise<void> {
  const err: FileError = toFileError(e);
  const detail = err.detail && err.code !== "file.tooNew" ? `\n\n${err.detail}` : "";
  await platform.alert(t(`errors.${err.code}`, { version: err.detail }) + detail);
}

/** Asks before throwing away unsaved changes. */
async function confirmDiscard(): Promise<boolean> {
  const s = state();
  if (!isDirty(s)) return true;
  return platform.confirm(
    t("file.discardQuestion", { name: s.file.name ?? untitled() }),
    t("file.discard"),
    t("file.cancel"),
  );
}

export async function newPresentation(): Promise<void> {
  if (!(await confirmDiscard())) return;
  loadDocument(createPresentation("", i18n.language));
  await platform.clearRecovery();
}

export async function openPresentation(): Promise<void> {
  if (!(await confirmDiscard())) return;
  try {
    const opened = await platform.open();
    if (!opened) return;
    loadDocument(opened.doc, opened.file);
    await platform.clearRecovery();
  } catch (e) {
    await showFileError(e);
  }
}

async function openPath(path: string): Promise<void> {
  try {
    const opened = await platform.openPath(path);
    loadDocument(opened.doc, opened.file);
  } catch (e) {
    await showFileError(e);
  }
}

async function saveWith(forceDialog: boolean): Promise<boolean> {
  const s = state();
  const savedEntry = s.past.at(-1) ?? null;
  const doc: Presentation = {
    ...s.doc,
    meta: { ...s.doc.meta, modified: new Date().toISOString() },
  };
  try {
    const file = await platform.save(doc, s.file, suggestedName(s), forceDialog);
    if (!file) return false;
    // Only mark clean if nothing changed while the dialog was open.
    if ((state().past.at(-1) ?? null) === savedEntry) markSaved(file);
    else useEditor.setState({ file });
    await platform.clearRecovery();
    return true;
  } catch (e) {
    await showFileError(e);
    return false;
  }
}

export const save = (): Promise<boolean> => saveWith(false);
export const saveAs = (): Promise<boolean> => saveWith(true);

// ---------------------------------------------------------------- session lifetime

function windowTitle(s: EditorState): string {
  return `${isDirty(s) ? "● " : ""}${s.file.name ?? untitled()} — Tiza`;
}

let startupDone = false;

async function startup(): Promise<void> {
  if (startupDone) return;
  startupDone = true;
  if (isDesktop) void invoke("confirm_gpu_launch").catch(() => {});
  const recovered = await platform.readRecovery().catch(() => null);
  if (recovered?.autoRestore) {
    loadDocument(recovered.doc, recovered.file);
    markUnsaved();
    await platform.clearRecovery();
    return;
  }
  if (recovered) {
    const restore = await platform.confirm(
      t("file.recoverQuestion", { name: recovered.file.name ?? untitled() }),
      t("file.recover"),
      t("file.discard"),
    );
    if (restore) {
      loadDocument(recovered.doc, recovered.file);
      markUnsaved();
      return;
    }
    await platform.clearRecovery();
  }
  const path = await platform.startupFile().catch(() => null);
  if (path) await openPath(path);
}

/** Starts autosave, title updates and the close guard. Returns a cleanup function. */
export function startSession(): () => void {
  void startup();

  let lastTitle = "";
  const updateTitle = () => {
    const title = windowTitle(state());
    if (title !== lastTitle) platform.setTitle((lastTitle = title));
  };
  updateTitle();
  const unsubscribe = useEditor.subscribe(updateTitle);
  i18n.on("languageChanged", updateTitle);

  let lastAutosaved: unknown = null;
  const timer = setInterval(() => {
    const s = state();
    const head = s.past.at(-1) ?? null;
    if (!isDirty(s) || head === lastAutosaved) return;
    lastAutosaved = head;
    void platform.writeRecovery(s.doc, s.file).catch(() => {});
  }, AUTOSAVE_MS);

  const offClose = platform.onClose(
    async () => {
      const ok = await confirmDiscard();
      if (ok) await platform.clearRecovery().catch(() => {});
      return ok;
    },
    () => isDirty(state()),
  );

  return () => {
    unsubscribe();
    i18n.off("languageChanged", updateTitle);
    clearInterval(timer);
    offClose();
  };
}

/**
 * Restarts the desktop app, carrying unsaved changes over without asking. Development
 * builds can't restart themselves (see `restart_app`): the user is told to do it.
 */
export async function restartApp(): Promise<void> {
  const s = state();
  if (isDirty(s)) await platform.writeRecovery(s.doc, s.file, true);
  const restarted = await invoke<boolean>("restart_app");
  if (!restarted) await platform.alert(t("settings.restartManually"));
}

/** Imports a PowerPoint file as a new, unsaved presentation with editable elements. */
export async function importPresentation(): Promise<void> {
  if (!(await confirmDiscard())) return;
  let picked: { name: string; bytes: Uint8Array } | null;
  try {
    picked = await platform.pickImportFile();
  } catch (e) {
    await showFileError(e);
    return;
  }
  if (!picked) return;
  const base = picked.name.replace(/\.[^.]+$/, "");
  try {
    const [{ importPptx }, { putAsset }] = await Promise.all([
      import("../import/pptx"),
      import("../assets/store"),
    ]);
    const { doc, skipped } = await importPptx(picked.bytes, {
      lang: i18n.language,
      title: base,
      putAsset,
    });
    loadDocument(doc, { name: `${base}.tiza`, path: null });
    markUnsaved();
    await platform.clearRecovery();
    const missing = Object.entries(skipped)
      .map(([kind, n]) => `${t(`import.kinds.${kind}`, { defaultValue: kind })}: ${n}`)
      .join(", ");
    await platform.notify(
      t("import.done", { count: doc.slides.length }) +
        (missing ? `\n\n${t("import.skipped", { list: missing })}` : ""),
    );
  } catch (e) {
    await platform.alert(
      t("import.error", { message: e instanceof Error ? e.message : String(e) }),
    );
  }
}
