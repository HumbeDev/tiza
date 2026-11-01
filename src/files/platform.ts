// File dialogs, storage and window integration for the desktop app (Tauri) and the web
// version. Everything above this module is platform-agnostic.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as dialog from "@tauri-apps/plugin-dialog";
import type { Presentation } from "../document";
import type { FileInfo } from "../store/editor";
import { addWebAssets, webAssetBytes } from "../assets/store";
import { FileError, assetNames, packTiza, toFileError, unpackTiza } from "./format";

export const isDesktop = isTauri();

export interface Recovered {
  doc: Presentation;
  file: FileInfo;
  savedAt: string;
  /** Saved by Tiza right before restarting itself: restore without asking. */
  autoRestore?: boolean;
}

export interface Platform {
  /** Shows an open dialog; null when cancelled. */
  open(): Promise<{ doc: Presentation; file: FileInfo } | null>;
  openPath(path: string): Promise<{ doc: Presentation; file: FileInfo }>;
  /** Saves to `file` if it has a known location, otherwise asks where. */
  save(
    doc: Presentation,
    file: FileInfo,
    suggestedName: string,
    forceDialog: boolean,
  ): Promise<FileInfo | null>;
  /** Lets the user choose a presentation to import; null when cancelled. */
  pickImportFile(): Promise<{ name: string; bytes: Uint8Array } | null>;
  /** An informational message (not an error). */
  notify(message: string): Promise<void>;
  /** Lets the user choose an .html file and returns its contents; null when cancelled. */
  pickHtmlFile(): Promise<{ name: string; text: string } | null>;
  confirm(message: string, okLabel: string, cancelLabel: string): Promise<boolean>;
  alert(message: string): Promise<void>;
  setTitle(title: string): void;
  writeRecovery(doc: Presentation, file: FileInfo, autoRestore?: boolean): Promise<void>;
  readRecovery(): Promise<Recovered | null>;
  clearRecovery(): Promise<void>;
  startupFile(): Promise<string | null>;
  /**
   * Desktop: calls `guard` before the window closes; returning false keeps it open.
   * Web: browsers only allow their generic "leave site?" prompt, shown when `hasUnsaved()`.
   */
  onClose(guard: () => Promise<boolean>, hasUnsaved: () => boolean): () => void;
}

const APP_VERSION = __APP_VERSION__;
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const withExtension = (name: string) => (/\.tiza$/i.test(name) ? name : `${name}.tiza`);
const FILTERS = [{ name: "Tiza", extensions: ["tiza"] }];
/** Formats Tiza can import (more will follow: odp, pdf, ppt). */
const IMPORT_EXTENSIONS = ["pptx"];

// ---------------------------------------------------------------- desktop

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    throw toFileError(e);
  }
}

const desktop: Platform = {
  async open() {
    const path = await dialog.open({ multiple: false, directory: false, filters: FILTERS });
    return typeof path === "string" ? this.openPath(path) : null;
  },

  async openPath(path) {
    const doc = await wrap(invoke<Presentation>("open_presentation", { path }));
    return { doc, file: { name: baseName(path), path } };
  },

  async save(doc, file, suggestedName, forceDialog) {
    let path = forceDialog ? null : file.path;
    if (!path) {
      const chosen = await dialog.save({
        defaultPath: file.path ?? suggestedName,
        filters: FILTERS,
      });
      if (!chosen) return null;
      path = withExtension(chosen);
    }
    await wrap(invoke("save_presentation", { path, doc }));
    return { name: baseName(path), path };
  },

  async pickImportFile() {
    const path = await dialog.open({
      multiple: false,
      directory: false,
      filters: [{ name: "PowerPoint", extensions: IMPORT_EXTENSIONS }],
    });
    if (typeof path !== "string") return null;
    const buffer = await wrap(invoke<ArrayBuffer>("read_import_file", { path }));
    return { name: baseName(path), bytes: new Uint8Array(buffer) };
  },

  async notify(message) {
    await dialog.message(message, { title: "Tiza", kind: "info" });
  },

  async pickHtmlFile() {
    const path = await dialog.open({
      multiple: false,
      directory: false,
      filters: [{ name: "HTML", extensions: ["html", "htm"] }],
    });
    if (typeof path !== "string") return null;
    const text = await wrap(invoke<string>("read_html_file", { path }));
    return { name: baseName(path), text };
  },

  confirm(message, okLabel, cancelLabel) {
    return dialog.ask(message, { title: "Tiza", kind: "warning", okLabel, cancelLabel });
  },

  async alert(message) {
    await dialog.message(message, { title: "Tiza", kind: "error" });
  },

  setTitle(title) {
    document.title = title;
    void getCurrentWindow().setTitle(title);
  },

  writeRecovery: (doc, file) =>
    wrap(
      invoke("write_recovery", {
        doc,
        info: { path: file.path, savedAt: new Date().toISOString() },
      }),
    ),

  async readRecovery() {
    const r = await wrap(
      invoke<{ doc: Presentation; info: { path: string | null; savedAt: string } } | null>(
        "read_recovery",
      ),
    );
    if (!r) return null;
    const path = r.info.path;
    return {
      doc: r.doc,
      file: { name: path ? baseName(path) : null, path },
      savedAt: r.info.savedAt,
    };
  },

  clearRecovery: () => wrap(invoke("clear_recovery")),

  startupFile: () => invoke<string | null>("startup_file"),

  onClose(guard) {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!(await guard())) event.preventDefault();
      })
      .then((off) => {
        if (disposed) off();
        else unlisten = off;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  },
};

// ---------------------------------------------------------------- web

const RECOVERY_KEY = "tiza.recovery";

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle>;
}

/** Where each web file was saved, when the browser supports real file handles. */
let webHandle: FileSystemFileHandle | null = null;

function pickFile(accept = ".tiza"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const web: Platform = {
  async open() {
    const picked = await pickFile();
    if (!picked) return null;
    const { doc, assets } = unpackTiza(new Uint8Array(await picked.arrayBuffer()));
    addWebAssets(assets);
    webHandle = null;
    return { doc, file: { name: picked.name, path: null } };
  },

  openPath() {
    return Promise.reject(new FileError("file.io", "not available on the web"));
  },

  async save(doc, file, suggestedName, forceDialog) {
    const bytes = packTiza(doc, APP_VERSION, await webAssetBytes(assetNames(doc)));
    const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
    if (picker) {
      try {
        if (forceDialog || !webHandle) {
          webHandle = await picker({
            suggestedName: file.name ?? suggestedName,
            types: [{ description: "Tiza", accept: { "application/x-tiza": [".tiza"] } }],
          });
        }
        const writable = await webHandle.createWritable();
        await writable.write(bytes as BlobPart);
        await writable.close();
        return { name: webHandle.name, path: null };
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return null;
        throw new FileError("file.io", String(e));
      }
    }
    // Browsers without file handles: every save is a download.
    const name = withExtension(file.name ?? suggestedName);
    download(bytes, name);
    return { name, path: null };
  },

  async pickImportFile() {
    const picked = await pickFile(IMPORT_EXTENSIONS.map((e) => `.${e}`).join(","));
    return picked ? { name: picked.name, bytes: new Uint8Array(await picked.arrayBuffer()) } : null;
  },

  notify: (message) => Promise.resolve(window.alert(message)),

  async pickHtmlFile() {
    const picked = await pickFile(".html,.htm,text/html");
    return picked ? { name: picked.name, text: await picked.text() } : null;
  },

  confirm: (message) => Promise.resolve(window.confirm(message)),
  alert: (message) => Promise.resolve(window.alert(message)),

  setTitle(title) {
    document.title = title;
  },

  async writeRecovery(doc, file) {
    try {
      localStorage.setItem(
        RECOVERY_KEY,
        JSON.stringify({ doc, file, savedAt: new Date().toISOString() }),
      );
    } catch {
      // Storage full or blocked: recovery is best-effort on the web.
    }
  },

  async readRecovery() {
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      return raw ? (JSON.parse(raw) as Recovered) : null;
    } catch {
      return null;
    }
  },

  async clearRecovery() {
    try {
      localStorage.removeItem(RECOVERY_KEY);
    } catch {
      // Nothing to clear.
    }
  },

  startupFile: () => Promise.resolve(null),

  onClose(_guard, hasUnsaved) {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsaved()) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  },
};

export const platform: Platform = isDesktop ? desktop : web;
