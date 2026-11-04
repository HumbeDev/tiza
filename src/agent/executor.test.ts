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
    await call("set_animation", { element_ids: [id], step: 3, effect: "zoom", exit: true });
    expect(doc().slides[0].elements[0].exit).toEqual({ step: 3, effect: "zoom" });
    expect((await call("set_animation", { element_ids: [id], step: 1, effect: "spin" })).ok).toBe(
      false,
    );
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

  it("sets the presentation's default transition", async () => {
    await call("add_slide");
    await call("set_slide", { slide: 1, transition: "rise", duration_ms: 700 });
    await call("set_presentation_transition", { transition: "zoom", apply_to_all: true });
    expect(doc().transition).toEqual({ kind: "zoom", durationMs: 500 });
    expect(doc().slides.every((s) => !s.transition)).toBe(true);
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

  it("embeds YouTube videos and X posts", async () => {
    const yt = await call("add_embed", {
      slide: 1,
      url: "https://youtu.be/dQw4w9WgXcQ?t=1m",
      x: 10,
    });
    expect(yt.result).toMatchObject({ provider: "youtube" });
    expect(doc().slides[0].elements[0]).toMatchObject({
      kind: "embed",
      provider: "youtube",
      media: "dQw4w9WgXcQ",
      start: 60,
      x: 10,
    });
    const id = doc().slides[0].elements[0].id;
    await call("update_element", {
      element_id: id,
      changes: { url: "https://x.com/NASA/status/1800000000000000000" },
    });
    expect(doc().slides[0].elements[0]).toMatchObject({
      provider: "x",
      media: "1800000000000000000",
    });
    expect(doc().slides[0].elements[0]).not.toHaveProperty("start", 60);

    const bad = await call("add_embed", { slide: 1, url: "not a link" });
    expect(bad.ok).toBe(false);
  });

  it("groups and ungroups elements", async () => {
    await call("add_shape", { slide: 1, shape: "rect" });
    await call("add_shape", { slide: 1, shape: "ellipse" });
    const ids = doc().slides[0].elements.map((e) => e.id);
    const grouped = await call("group_elements", { element_ids: ids });
    expect(grouped.ok).toBe(true);
    expect(new Set(doc().slides[0].elements.map((e) => e.groupId)).size).toBe(1);
    expect((await call("group_elements", { element_ids: [ids[0]] })).ok).toBe(false);
    await call("ungroup_elements", { element_ids: ids });
    expect(doc().slides[0].elements.every((e) => !e.groupId)).toBe(true);
  });

  it("styles fragments of a text box", async () => {
    await call("add_text", { slide: 1, text: "Velocidad v y aceleración a" });
    const id = doc().slides[0].elements[0].id;
    const r = await call("style_text", {
      element_id: id,
      match: "v",
      color: "#d62828",
      font_size: 90,
    });
    expect(r.result).toMatchObject({ styled: 1 });
    await call("style_text", { element_id: id, align: "center" });
    const el = doc().slides[0].elements[0];
    expect(el.kind === "text" && JSON.stringify(el.doc)).toContain('"color":"#d62828"');
    expect(el.kind === "text" && el.doc.content?.[0].attrs?.textAlign).toBe("center");
    expect((await call("style_text", { element_id: id, match: "zzz", bold: true })).ok).toBe(false);
  });
});
