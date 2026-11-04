import type { RichMark, RichNode } from ".";

/** A TipTap document with one paragraph per line. */
export function plainDoc(text: string): RichNode {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

/** Text content, with inline formulas as `$latex$` and one line per block. */
export function toPlainText(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "inlineMath") return `$${String(node.attrs?.latex ?? "")}$`;
  if (node.type === "hardBreak") return "\n";
  const children = (node.content ?? []).map(toPlainText);
  const isBlockContainer = ["doc", "bulletList", "orderedList", "listItem"].includes(node.type);
  return children.join(isBlockContainer ? "\n" : "");
}

export interface TextStyleChange {
  color?: string | null;
  /** Slide units (same as the element's font size); null removes it. */
  fontSize?: number | null;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** Applies `style` to a text node's marks (TipTap's `textStyle` holds color and size). */
function applyMarks(marks: RichMark[] | undefined, style: TextStyleChange): RichMark[] {
  let out = [...(marks ?? [])];
  for (const flag of ["bold", "italic", "underline"] as const) {
    if (style[flag] === undefined) continue;
    out = out.filter((m) => m.type !== flag);
    if (style[flag]) out.push({ type: flag });
  }
  if (style.color !== undefined || style.fontSize !== undefined) {
    const current = out.find((m) => m.type === "textStyle")?.attrs ?? {};
    const attrs: Record<string, unknown> = { ...current };
    if (style.color !== undefined) attrs.color = style.color;
    if (style.fontSize !== undefined)
      attrs.fontSize = style.fontSize === null ? null : `${style.fontSize}px`;
    out = out.filter((m) => m.type !== "textStyle");
    if (Object.values(attrs).some((v) => v !== null && v !== undefined))
      out.push({ type: "textStyle", attrs });
  }
  return out;
}

/**
 * Styles every occurrence of `match` in the document (or all text when `match` is
 * empty), splitting text nodes as needed. Returns the new document and the count.
 */
export function styleText(
  doc: RichNode,
  match: string,
  style: TextStyleChange,
): { doc: RichNode; count: number } {
  let count = 0;
  const visit = (node: RichNode): RichNode[] => {
    if (node.type !== "text") {
      return node.content ? [{ ...node, content: node.content.flatMap(visit) }] : [node];
    }
    const text = node.text ?? "";
    if (!match) {
      count++;
      return [{ ...node, marks: applyMarks(node.marks, style) }];
    }
    const parts: RichNode[] = [];
    let from = 0;
    for (let at = text.indexOf(match); at >= 0; at = text.indexOf(match, at + match.length)) {
      if (at > from) parts.push({ ...node, text: text.slice(from, at) });
      parts.push({ ...node, text: match, marks: applyMarks(node.marks, style) });
      from = at + match.length;
      count++;
    }
    if (parts.length === 0) return [node];
    if (from < text.length) parts.push({ ...node, text: text.slice(from) });
    // Drop empty `marks` arrays so documents stay as TipTap writes them.
    for (const p of parts) if (!p.marks?.length) delete p.marks;
    return parts;
  };
  return { doc: visit(doc)[0], count };
}

/** Sets the alignment of paragraph `index` (0-based, in reading order) or of all of them. */
export function alignParagraphs(
  doc: RichNode,
  align: "left" | "center" | "right" | "justify" | null,
  index?: number,
): RichNode {
  let n = -1;
  const visit = (node: RichNode): RichNode => {
    if (node.type === "paragraph") {
      n++;
      if (index !== undefined && n !== index) return node;
      const attrs = { ...node.attrs, textAlign: align };
      return { ...node, attrs };
    }
    return node.content ? { ...node, content: node.content.map(visit) } : node;
  };
  return visit(doc);
}
