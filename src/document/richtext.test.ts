import { describe, expect, it } from "vitest";
import { alignParagraphs, plainDoc, styleText, toPlainText } from "./richtext";

describe("rich text helpers", () => {
  it("round-trips plain text through paragraphs", () => {
    const doc = plainDoc("Hello\n\nworld");
    expect(doc.content).toHaveLength(3);
    expect(doc.content?.[1].content).toBeUndefined();
    expect(toPlainText(doc)).toBe("Hello\n\nworld");
  });

  it("writes inline math as $…$", () => {
    expect(
      toPlainText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "E = " },
              { type: "inlineMath", attrs: { latex: "mc^2" } },
            ],
          },
        ],
      }),
    ).toBe("E = $mc^2$");
  });
});

describe("styleText", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "La energía E y la masa m", marks: [{ type: "italic" }] }],
      },
    ],
  };

  it("splits text around each match and adds color and size", () => {
    const { doc: out, count } = styleText(doc, "la", { color: "#ff0000", fontSize: 72 });
    expect(count).toBe(1);
    const nodes = out.content![0].content!;
    expect(nodes.map((n) => n.text)).toEqual(["La energía E y ", "la", " masa m"]);
    expect(nodes[1].marks).toEqual([
      { type: "italic" },
      { type: "textStyle", attrs: { color: "#ff0000", fontSize: "72px" } },
    ]);
    expect(nodes[0].marks).toEqual([{ type: "italic" }]);
  });

  it("styles all text when match is empty and can remove marks", () => {
    const { doc: out } = styleText(doc, "", { italic: false, bold: true });
    expect(out.content![0].content![0].marks).toEqual([{ type: "bold" }]);
  });
});

describe("alignParagraphs", () => {
  it("aligns one paragraph or all", () => {
    const doc = plainDoc("a\nb");
    expect(alignParagraphs(doc, "center", 1).content!.map((p) => p.attrs?.textAlign)).toEqual([
      undefined,
      "center",
    ]);
    expect(
      alignParagraphs(doc, "right").content!.every((p) => p.attrs?.textAlign === "right"),
    ).toBe(true);
  });
});
