// `.tiza` reading/writing for the web version. Same layout as src-tauri/src/archive:
// a ZIP with manifest.json and presentation.json.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { type Presentation, SCHEMA_VERSION } from "../document";

export const FORMAT = "tiza";
const MAX_DOCUMENT_BYTES = 64 * 1024 * 1024;

/** Error codes shared with Rust's `AppError` (translated under `errors.*`). */
export type FileErrorCode =
  | "file.io"
  | "file.notTiza"
  | "file.invalid"
  | "file.tooNew"
  | "file.tooLarge"
  | "file.unsafePath"
  | "file.badExtension";

export class FileError extends Error {
  constructor(
    readonly code: FileErrorCode,
    readonly detail = "",
  ) {
    super(detail || code);
  }
}

/** Errors from Rust arrive as `{ code, detail }`. */
export function toFileError(e: unknown): FileError {
  if (e instanceof FileError) return e;
  if (typeof e === "object" && e !== null && "code" in e) {
    const { code, detail } = e as { code: FileErrorCode; detail?: string };
    return new FileError(code, detail ?? "");
  }
  return new FileError("file.io", String(e));
}

export function packTiza(doc: Presentation, appVersion: string): Uint8Array {
  const manifest = { format: FORMAT, schemaVersion: SCHEMA_VERSION, appVersion };
  return zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "presentation.json": strToU8(JSON.stringify(doc, null, 2)),
  });
}

export function unpackTiza(bytes: Uint8Array): Presentation {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new FileError("file.notTiza");
  }
  for (const name of Object.keys(files)) {
    if (name.startsWith("/") || name.split(/[\\/]/).includes("..")) {
      throw new FileError("file.unsafePath", name);
    }
  }
  const manifest = parseJson(files["manifest.json"], "manifest.json");
  if (manifest?.format !== FORMAT) throw new FileError("file.notTiza");
  if (manifest.schemaVersion > SCHEMA_VERSION) {
    throw new FileError("file.tooNew", String(manifest.schemaVersion));
  }
  return validate(parseJson(files["presentation.json"], "presentation.json"));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(data: Uint8Array | undefined, name: string): any {
  if (!data) throw new FileError("file.notTiza");
  if (data.length > MAX_DOCUMENT_BYTES) throw new FileError("file.tooLarge");
  try {
    return JSON.parse(strFromU8(data));
  } catch (e) {
    throw new FileError("file.invalid", `${name}: ${String(e)}`);
  }
}

/**
 * Structural checks for documents opened in the browser. The desktop app validates with
 * serde in Rust (and runs migrations); keep both in sync when the schema changes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validate(doc: any): Presentation {
  const fail = (why: string): never => {
    throw new FileError("file.invalid", why);
  };
  if (typeof doc !== "object" || doc === null) fail("not an object");
  if (typeof doc.schemaVersion !== "number" || doc.schemaVersion < 1) fail("schemaVersion");
  if (doc.schemaVersion > SCHEMA_VERSION)
    throw new FileError("file.tooNew", String(doc.schemaVersion));
  if (typeof doc.page?.width !== "number" || typeof doc.page?.height !== "number") fail("page");
  if (!Array.isArray(doc.slides) || doc.slides.length === 0) fail("no slides");
  for (const slide of doc.slides) {
    if (typeof slide?.id !== "string" || !Array.isArray(slide.elements)) fail("slide");
    for (const el of slide.elements) {
      if (typeof el?.id !== "string" || !["shape", "text", "math", "sim"].includes(el.kind)) {
        fail(`element ${String(el?.id)}`);
      }
    }
  }
  doc.latex ??= { preamble: "" };
  for (const slide of doc.slides) {
    slide.notes ??= "";
    slide.hidden ??= false;
    for (const el of slide.elements) {
      el.locked ??= false;
      if (el.kind === "sim") el.allowNetwork ??= false;
    }
  }
  return doc as Presentation;
}
