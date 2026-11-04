import { beforeEach, describe, expect, it } from "vitest";
import { createPresentation, createShape, createText } from "../document/factory";
import { addElement, groupElements, loadDocument, useEditor } from "../store/editor";
import { pasteData, readElements, writeElements } from "./clipboard";

class FakeData {
  store = new Map<string, string>();
  files = [] as unknown as FileList;
  setData(type: string, value: string) {
    this.store.set(type, value);
  }
  getData(type: string) {
    return this.store.get(type) ?? "";
  }
}

const elements = () => useEditor.getState().doc.slides[0].elements;

beforeEach(() => loadDocument(createPresentation("t", "es")));

describe("clipboard", () => {
  it("round-trips elements through HTML, with plain text for other apps", () => {
    const text = createText("Hola ñandú", 100, 100);
    const data = new FakeData();
    writeElements(data as unknown as DataTransfer, [text]);
    expect(data.getData("text/plain")).toBe("Hola ñandú");
    expect(readElements(data.getData("text/html"))).toEqual([text]);
  });

  it("pastes copies with new ids and their own group", () => {
    const a = createShape("rect", 100, 100);
    const b = createShape("ellipse", 300, 100);
    addElement(a);
    addElement(b);
    groupElements([a.id, b.id]);
    const data = new FakeData();
    writeElements(data as unknown as DataTransfer, elements());
    pasteData(data as unknown as DataTransfer);
    const all = elements();
    expect(all).toHaveLength(4);
    expect(new Set(all.map((e) => e.id)).size).toBe(4);
    expect(all[2].x).toBe(all[0].x + 20); // same slide: shifted
    expect(all[2].groupId).toBeDefined();
    expect(all[2].groupId).toBe(all[3].groupId);
    expect(all[2].groupId).not.toBe(all[0].groupId);
  });

  it("turns text from other apps into a text box and links into embeds", () => {
    const text = new FakeData();
    text.setData("text/plain", "Apuntes de la clase");
    pasteData(text as unknown as DataTransfer);
    const link = new FakeData();
    link.setData("text/plain", "https://youtu.be/dQw4w9WgXcQ");
    pasteData(link as unknown as DataTransfer);
    expect(elements().map((e) => e.kind)).toEqual(["text", "embed"]);
  });
});
