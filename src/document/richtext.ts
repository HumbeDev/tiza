import type { RichNode } from ".";

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
