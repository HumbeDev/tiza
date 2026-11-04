// System clipboard. Copied elements travel as HTML with the Tiza data inside (so they paste
// into another Tiza window, the web version or, as plain text, into other apps). Pasting
// from other apps: pictures become images, links to YouTube/X/web pages become embeds,
// other text becomes a text box.
import { imageSize, putAsset } from "../assets/store";
import type { Element } from "../document";
import { createEmbed, createImage, createText } from "../document/factory";
import { toPlainText } from "../document/richtext";
import { parseEmbed } from "../elements/embed/parse";
import { addElement, currentSlide, pasteElements, useEditor } from "../store/editor";

const MARK = "data-tiza-clipboard";
const encoder = new TextEncoder();

function toBase64(text: string): string {
  let s = "";
  for (const b of encoder.encode(text)) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(data: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** What other apps get as text. */
function plainText(elements: Element[]): string {
  return elements
    .map((e) =>
      e.kind === "text"
        ? toPlainText(e.doc)
        : e.kind === "math"
          ? e.latex
          : e.kind === "table"
            ? e.rows.map((r) => r.join("\t")).join("\n")
            : e.kind === "embed"
              ? e.url
              : "",
    )
    .filter(Boolean)
    .join("\n\n");
}

/** Fills a copy/cut event with the elements. Must run synchronously in the handler. */
export function writeElements(data: DataTransfer, elements: Element[]): void {
  const text = plainText(elements);
  const payload = toBase64(JSON.stringify({ v: 1, elements }));
  data.setData("text/html", `<div ${MARK}="${payload}">${escapeHtml(text)}</div>`);
  data.setData("text/plain", text);
}

export function readElements(html: string): Element[] | null {
  const m = new RegExp(`${MARK}="([^"]+)"`).exec(html);
  if (!m) return null;
  try {
    const parsed = JSON.parse(fromBase64(m[1])) as { v?: number; elements?: Element[] };
    return Array.isArray(parsed.elements) ? parsed.elements : null;
  } catch {
    return null;
  }
}

function center() {
  const { width, height } = useEditor.getState().doc.page;
  return { cx: width / 2, cy: height / 2 };
}

/** Handles a paste event's data; false when there was nothing Tiza could use. */
export function pasteData(data: DataTransfer): boolean {
  const elements = readElements(data.getData("text/html"));
  if (elements?.length) {
    // Pasting onto the same slide shifts the copy so it doesn't hide the original.
    const here = new Set(currentSlide(useEditor.getState()).elements.map((e) => e.id));
    pasteElements(elements, elements.some((e) => here.has(e.id)) ? 20 : 0);
    return true;
  }

  const picture = Array.from(data.files).find((f) => f.type.startsWith("image/"));
  if (picture) {
    void (async () => {
      const ext = picture.type.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg");
      const bytes = new Uint8Array(await picture.arrayBuffer());
      const name = await putAsset(bytes, ext ?? "png");
      const { cx, cy } = center();
      addElement(createImage(name, await imageSize(bytes, ext ?? "png"), cx, cy));
    })();
    return true;
  }

  const text = data.getData("text/plain").trim();
  if (!text) return false;
  const { cx, cy } = center();
  const embed = /^\S+$/.test(text) && /^https?:\/\//i.test(text) ? parseEmbed(text) : null;
  addElement(embed ? createEmbed(embed, embed.link, cx, cy) : createText(text, cx, cy));
  return true;
}
