import { describe, expect, it } from "vitest";
import { plainDoc, toPlainText } from "./richtext";

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
