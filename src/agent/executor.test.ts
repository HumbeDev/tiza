import { beforeEach, describe, expect, it } from "vitest";
import { createPresentation } from "../document/factory";
import { loadDocument, undo, useEditor } from "../store/editor";
import { runTool } from "./executor";

const call = (tool: string, args: Record<string, unknown> = {}) => runTool({ id: 1, tool, args });
const doc = () => useEditor.getState().doc;

beforeEach(() => loadDocument(createPresentation("Charla", "es")));

describe("agent tools", () => {
  it("describes the presentation", async () => {
    const { ok, result } = await call("get_presentation");
    expect(ok).toBe(true);
    expect(result).toMatchObject({
      title: "Charla",
      page: { width: 1920, height: 1080 },
      slides: [{ number: 1 }],
    });
  });

  it("adds slides and elements, each call being one undo step", async () => {
    const added = await call("add_slide");
    expect(added.result).toMatchObject({ number: 2 });
    const text = await call("add_text", {
      slide: 2,
      text: "Ley de Newton: $F = ma$\n- inercia\n- acción y reacción",
      x: 100,
      y: 80,
      font_size: 60,
      color: "#123456",
    });
    expect(text.ok).toBe(true);
    const el = doc().slides[1].elements[0];
    expect(el).toMatchObject({ kind: "text", x: 100, y: 80, fontSize: 60, color: "#123456" });
    expect(el.kind === "text" && el.doc.content?.map((n) => n.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
    expect(useEditor.getState().currentSlideId).toBe(doc().slides[1].id);

    await call("add_table", {
      slide: 2,
      rows: [
        ["a", "b"],
        [1, null],
      ],
      theme: "blue",
    });
    expect(doc().slides[1].elements[1]).toMatchObject({
      kind: "table",
      rows: [
        ["a", "b"],
        ["1", ""],
      ],
      theme: "blue",
    });

    undo();
    expect(doc().slides[1].elements).toHaveLength(1);
    undo();
    expect(doc().slides[1].elements).toHaveLength(0);
  });

  it("updates, animates and deletes elements", async () => {
    const { result } = await call("add_shape", {
      slide: 1,
      shape: "ellipse",
      w: 200,
      h: 100,
      fill: "#ff0000",
    });
    const id = (result as { element_id: string }).element_id;
    expect(
      (await call("update_element", { element_id: id, changes: { x: 5, fill: "none", bogus: 1 } }))
        .result,
    ).toEqual({
      ok: true,
      ignored: ["bogus"],
    });
    expect(doc().slides[0].elements[0]).toMatchObject({ x: 5, fill: undefined });
    await call("set_animation", { element_ids: [id], step: 2, effect: "fade" });
    expect(doc().slides[0].elements[0].build).toEqual({ step: 2, effect: "fade" });
    expect((await call("delete_elements", { element_ids: [id] })).result).toEqual({ removed: 1 });
  });

  it("gives clear errors", async () => {
    expect(await call("add_text", { slide: 9, text: "x" })).toEqual({
      ok: false,
      result: "No slide 9. The presentation has 1 slides (1-1).",
    });
    expect((await call("add_shape", { slide: 1, shape: "star" })).ok).toBe(false);
    expect((await call("update_element", { element_id: "nope", changes: {} })).ok).toBe(false);
    expect((await call("save")).result).toMatch(/never been saved/);
    expect((await call("explode")).ok).toBe(false);
  });

  it("moves and edits slides", async () => {
    await call("add_slide");
    await call("set_slide", {
      slide: 2,
      notes: "Hola",
      hidden: true,
      background: "#000000",
      transition: "fade",
    });
    expect(doc().slides[1]).toMatchObject({
      notes: "Hola",
      hidden: true,
      background: "#000000",
      transition: { kind: "fade" },
    });
    const second = doc().slides[1].id;
    await call("move_slide", { slide: second, to: 1 });
    expect(doc().slides[0].id).toBe(second);
  });
});
