import type { RichNode } from "../document";

/**
 * Plain text from an agent → rich text: lines are paragraphs, "- " / "* " bullets,
 * "1. " numbered items, $...$ inline LaTeX and **bold**.
 */
export function agentTextToDoc(text: string): RichNode {
  const content: RichNode[] = [];
  let list: RichNode | null = null;
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const kind = bullet ? "bulletList" : numbered ? "orderedList" : null;
    const body = bullet?.[1] ?? numbered?.[1] ?? line;
    const inline = inlineNodes(body);
    const paragraph: RichNode = {
      type: "paragraph",
      ...(inline.length ? { content: inline } : {}),
    };
    if (kind) {
      if (!list || list.type !== kind) {
        list = { type: kind, content: [] };
        content.push(list);
      }
      list.content!.push({ type: "listItem", content: [paragraph] });
    } else {
      list = null;
      content.push(paragraph);
    }
  }
  return { type: "doc", content };
}

function inlineNodes(text: string): RichNode[] {
  const out: RichNode[] = [];
  // $math$ (not "$ " prices) and **bold** spans.
  const pattern = /\$([^$\s](?:[^$]*[^$\s])?)\$|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "inlineMath", attrs: { latex: m[1] } });
    else out.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}
