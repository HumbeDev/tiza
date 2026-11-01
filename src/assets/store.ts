// Pictures (and later video) referenced as `sha256-<hex>.<ext>`. Desktop: Rust keeps them
// in a session folder and serves them as tizaasset://. Web: they stay in memory as Blobs.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import * as dialog from "@tauri-apps/plugin-dialog";
import type { ImportedAsset } from "../bindings/ImportedAsset";
import { isDesktop } from "../files/platform";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
/** WebM/VP9 plays everywhere; MP4 (H.264) needs the system's codecs on Linux. */
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "webm", "ogv", "mov"];

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
};

export const ASSET_NAME =
  /^sha256-[0-9a-f]{64}\.(png|jpg|jpeg|gif|webp|svg|bmp|avif|mp4|m4v|webm|ogv|mov)$/;

export const extensionOf = (name: string): string => name.split(".").pop()?.toLowerCase() ?? "";

const webBlobs = new Map<string, Blob>();
const webUrls = new Map<string, string>();

/** URL to display an asset in <img>/<video>. */
export function assetUrl(name: string): string {
  if (isDesktop) return convertFileSrc(name, "tizaasset");
  let url = webUrls.get(name);
  if (!url) {
    const blob = webBlobs.get(name);
    if (!blob) return "";
    url = URL.createObjectURL(blob);
    webUrls.set(name, url);
  }
  return url;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stores bytes and returns the asset name (same name for the same content). */
export async function putAsset(bytes: Uint8Array, ext: string): Promise<string> {
  const e = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
  if (!MIME[e]) throw new Error(`unsupported asset type: ${ext}`);
  if (isDesktop) return invoke<string>("put_asset", bytes, { headers: { "x-ext": e } });
  const name = `sha256-${await sha256Hex(bytes)}.${e}`;
  if (!webBlobs.has(name)) webBlobs.set(name, new Blob([bytes as BlobPart], { type: MIME[e] }));
  return name;
}

/** Web: the bytes of these assets, to pack them into a .tiza file. */
export async function webAssetBytes(names: string[]): Promise<Record<string, Uint8Array>> {
  const out: Record<string, Uint8Array> = {};
  for (const name of names) {
    const blob = webBlobs.get(name);
    if (blob) out[name] = new Uint8Array(await blob.arrayBuffer());
  }
  return out;
}

/** Web: assets read from a .tiza file. */
export function addWebAssets(assets: Record<string, Uint8Array>): void {
  for (const [name, bytes] of Object.entries(assets)) {
    if (!webBlobs.has(name))
      webBlobs.set(name, new Blob([bytes as BlobPart], { type: MIME[extensionOf(name)] }));
  }
}

async function naturalSize(blob: Blob): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return {};
  }
}

/** Asks the user for a picture and stores it. Null when cancelled. */
export function pickImage(): Promise<ImportedAsset | null> {
  return pickMedia(IMAGE_EXTENSIONS, "Images");
}

/** Asks the user for a video and stores it. Null when cancelled. */
export function pickVideo(): Promise<ImportedAsset | null> {
  return pickMedia(VIDEO_EXTENSIONS, "Video");
}

async function pickMedia(extensions: string[], label: string): Promise<ImportedAsset | null> {
  if (isDesktop) {
    const path = await dialog.open({
      multiple: false,
      directory: false,
      filters: [{ name: label, extensions }],
    });
    return typeof path === "string" ? invoke<ImportedAsset>("import_image", { path }) : null;
  }
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = extensions.map((e) => `.${e}`).join(",");
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
  if (!file) return null;
  const name = await putAsset(new Uint8Array(await file.arrayBuffer()), extensionOf(file.name));
  return { name, ...(extensions === IMAGE_EXTENSIONS ? await naturalSize(file) : {}) };
}

/** Pixel size of an asset's image (used by the importers when the file doesn't say). */
export async function imageSize(
  bytes: Uint8Array,
  ext: string,
): Promise<{ width?: number; height?: number }> {
  return naturalSize(new Blob([bytes as BlobPart], { type: MIME[ext] ?? "" }));
}

const mediaUrls = new Map<string, Promise<string>>();

/**
 * URL for <video>. WebKitGTK's media player can't read custom protocols (tizaasset://
 * fails with MEDIA_ERR_SRC_NOT_SUPPORTED), so on the desktop the bytes are fetched from
 * Rust once and played from a blob: URL. Very large videos therefore use that much memory.
 */
export function mediaUrl(name: string): Promise<string> {
  if (!isDesktop) return Promise.resolve(assetUrl(name));
  let url = mediaUrls.get(name);
  if (!url) {
    url = invoke<ArrayBuffer>("read_asset", { name }).then((bytes) =>
      URL.createObjectURL(new Blob([bytes], { type: MIME[extensionOf(name)] ?? "video/mp4" })),
    );
    mediaUrls.set(name, url);
    url.catch(() => mediaUrls.delete(name));
  }
  return url;
}
