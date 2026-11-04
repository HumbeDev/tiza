import { describe, expect, it } from "vitest";
import { agentTextToDoc } from "./text";

describe("agentTextToDoc", () => {
  it("turns lines into paragraphs with inline math and bold", () => {
    expect(agentTextToDoc("Energía: $E=mc^2$ es **clave**\n\nFin")).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Energía: " },
            { type: "inlineMath", attrs: { latex: "E=mc^2" } },
            { type: "text", text: " es " },
            { type: "text", text: "clave", marks: [{ type: "bold" }] },
          ],
        },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "Fin" }] },
      ],
    });
  });

  it("groups bullets and numbered items into lists", () => {
    const doc = agentTextToDoc("Puntos:\n- uno\n- dos\n1. primero\n2. segundo");
    expect(doc.content?.map((n) => n.type)).toEqual(["paragraph", "bulletList", "orderedList"]);
    expect(doc.content?.[1].content).toHaveLength(2);
    expect(doc.content?.[2].content).toHaveLength(2);
  });

  it("leaves prices alone", () => {
    expect(agentTextToDoc("cuesta $5 y $10").content?.[0].content).toEqual([
      { type: "text", text: "cuesta $5 y $10" },
    ]);
  });
});
