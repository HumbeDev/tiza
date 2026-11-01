import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Element, RichNode } from "../document";
import { importPptx, lineGeometry, resolvePath } from "./pptx";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const rels = (items: [string, string, string][]) =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items
    .map(
      ([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`,
    )
    .join("")}</Relationships>`;

// 16:9 slide = 12192000 × 6858000 EMU → 1920 × 1080 (1 unit = 6350 EMU).
const PRESENTATION = `<p:presentation ${NS}>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`;

const THEME = `<a:theme ${NS}><a:themeElements><a:clrScheme name="t">
  <a:dk1><a:sysClr val="windowText" lastClr="111111"/></a:dk1>
  <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
  <a:dk2><a:srgbClr val="222222"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>
  <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
</a:clrScheme></a:themeElements></a:theme>`;

// Master: title placeholder geometry, title style 44pt centered, body 28pt with bullets,
// and a decoration bar (non-placeholder) that every slide shows.
const MASTER = `<p:sldMaster ${NS}><p:cSld>
  <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FAFAFA"/></a:solidFill></p:bgPr></p:bg>
  <p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="635000" y="317500"/><a:ext cx="10922000" cy="1270000"/></a:xfrm></p:spPr>
      <p:txBody><a:bodyPr/><a:p><a:r><a:t>Click to edit title</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="0" y="6350000"/><a:ext cx="12192000" cy="508000"/></a:xfrm>
        <a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr></p:sp>
  </p:spTree></p:cSld>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="4400" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr><a:buChar char="•"/><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle>
    <p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;

const LAYOUT = `<p:sldLayout ${NS}><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:t>Layout prompt</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="635000" y="1905000"/><a:ext cx="10922000" cy="3810000"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:p><a:r><a:t>Body prompt</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sldLayout>`;

const SLIDE1 = `<p:sld ${NS}><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr/><p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="es"/><a:t>Física moderna</a:t></a:r></a:p></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr/><p:txBody><a:bodyPr><a:normAutofit fontScale="50000"/></a:bodyPr>
      <a:p><a:r><a:t>Relatividad</a:t></a:r></a:p>
      <a:p><a:r><a:rPr i="1"/><a:t>Cuántica</a:t></a:r></a:p>
    </p:txBody></p:sp>
  <p:pic><p:nvPicPr><p:cNvPr id="4" name="Pic"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="rId5"/></p:blipFill>
    <p:spPr><a:xfrm><a:off x="6350000" y="3175000"/><a:ext cx="1270000" cy="635000"/></a:xfrm></p:spPr></p:pic>
  <p:sp><p:nvSpPr><p:cNvPr id="5" name="Oval"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm rot="5400000"><a:off x="0" y="0"/><a:ext cx="635000" cy="635000"/></a:xfrm><a:prstGeom prst="ellipse"/>
      <a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></p:spPr></p:sp>
  <p:cxnSp><p:nvCxnSpPr><p:cNvPr id="6" name="Arrow"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="635000" cy="0"/></a:xfrm><a:prstGeom prst="straightConnector1"/>
      <a:ln w="25400"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>
  <p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
    <p:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></p:xfrm>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>
      <a:tblPr firstRow="1" bandRow="1"/>
      <a:tr><a:tc><a:txBody><a:p><a:r><a:rPr sz="1400"/><a:t>Calibre</a:t></a:r></a:p></a:txBody></a:tc>
            <a:tc><a:txBody><a:p><a:r><a:t>dB</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
      <a:tr><a:tc><a:txBody><a:p><a:r><a:t>.22 LR</a:t></a:r></a:p></a:txBody></a:tc>
            <a:tc><a:txBody><a:p><a:r><a:t>94,5</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
    </a:tbl></a:graphicData></a:graphic></p:graphicFrame>
</p:spTree></p:cSld></p:sld>`;

const SLIDE2 = `<p:sld ${NS} show="0"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="Box"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="635000" y="635000"/><a:ext cx="3175000" cy="635000"/></a:xfrm><a:noFill/></p:spPr>
    <p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0"/>
      <a:p><a:pPr algn="r"/><a:r><a:rPr sz="2400" b="1" u="sng"><a:solidFill><a:srgbClr val="C00000"/></a:solidFill></a:rPr><a:t>Hola</a:t></a:r><a:br/><a:r><a:t>mundo</a:t></a:r></a:p>
    </p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

const NOTES = `<p:notes ${NS}><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
    <p:txBody><a:bodyPr/><a:p><a:r><a:t>Saludar</a:t></a:r></a:p><a:p><a:r><a:t>Mostrar la gráfica</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:notes>`;

function pptx(): Uint8Array {
  const files: Record<string, string | Uint8Array> = {
    "ppt/presentation.xml": PRESENTATION,
    "ppt/_rels/presentation.xml.rels": rels([
      ["rId1", "slideMaster", "slideMasters/slideMaster1.xml"],
      ["rId2", "slide", "slides/slide1.xml"],
      ["rId3", "slide", "slides/slide2.xml"],
    ]),
    "ppt/slideMasters/slideMaster1.xml": MASTER,
    "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels([
      ["rId1", "theme", "../theme/theme1.xml"],
    ]),
    "ppt/theme/theme1.xml": THEME,
    "ppt/slideLayouts/slideLayout1.xml": LAYOUT,
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels": rels([
      ["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"],
    ]),
    "ppt/slides/slide1.xml": SLIDE1,
    "ppt/slides/_rels/slide1.xml.rels": rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
      ["rId5", "image", "../media/image1.png"],
      ["rId9", "notesSlide", "../notesSlides/notesSlide1.xml"],
    ]),
    "ppt/slides/slide2.xml": SLIDE2,
    "ppt/slides/_rels/slide2.xml.rels": rels([
      ["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"],
    ]),
    "ppt/notesSlides/notesSlide1.xml": NOTES,
    "ppt/media/image1.png": new Uint8Array([137, 80, 78, 71]),
    "docProps/core.xml": `<cp:coreProperties xmlns:cp="x" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Charla</dc:title></cp:coreProperties>`,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, typeof v === "string" ? strToU8(v) : v]),
    ),
  );
}

const stored: Record<string, Uint8Array> = {};
const putAsset = async (bytes: Uint8Array, ext: string) => {
  const name = `sha256-${"0".repeat(63)}${Object.keys(stored).length}.${ext}`;
  stored[name] = bytes;
  return name;
};

const texts = (n: RichNode): string =>
  n.type === "text"
    ? (n.text ?? "")
    : n.type === "hardBreak"
      ? "\n"
      : (n.content ?? []).map(texts).join(n.type === "doc" ? "|" : "");

const byKind = <K extends Element["kind"]>(els: Element[], kind: K) =>
  els.filter((e): e is Extract<Element, { kind: K }> => e.kind === kind);

describe("importPptx", async () => {
  const { doc, skipped } = await importPptx(pptx(), { lang: "es", putAsset });
  const [s1, s2] = doc.slides;

  it("reads slide size, title and order", () => {
    expect(doc.page).toEqual({ aspect: "16:9", width: 1920, height: 1080 });
    expect(doc.meta.title).toBe("Charla");
    expect(doc.slides).toHaveLength(2);
    expect(s2.hidden).toBe(true);
    expect(s1.background).toBe("#fafafa");
  });

  it("keeps master decorations behind the slide content", () => {
    const bar = s1.elements[0];
    expect(bar.kind).toBe("shape");
    expect(bar).toMatchObject({ y: 1000, h: 80, w: 1920, fill: "#4472c4" });
    // Master/layout prompts ("Click to edit title") are not imported.
    expect(byKind(s1.elements, "text").map((t) => texts(t.doc))).not.toContain(
      "Click to edit title",
    );
  });

  it("inherits title position and style from the layout and master", () => {
    const title = byKind(s1.elements, "text").find((t) => texts(t.doc) === "Física moderna")!;
    // Position from the master (offset by the default 0.1" × 0.05" text insets).
    expect(title.x).toBeCloseTo(100 + 14.4, 1);
    expect(title.y).toBeCloseTo(50 + 7.2, 1);
    expect(title.align).toBe("center");
    expect(title.color).toBe("#111111");
    // 44pt × 12700 EMU/pt ÷ 6350 EMU/unit = 88 units, bold from the master style.
    expect(title.fontSize).toBeCloseTo(88);
    expect(title.doc.content?.[0].content?.[0].marks).toEqual([{ type: "bold" }]);
  });

  it("turns body placeholders into bullet lists and applies autofit", () => {
    const body = byKind(s1.elements, "text").find((t) => texts(t.doc).includes("Relatividad"))!;
    expect(body.doc.content?.[0].type).toBe("bulletList");
    expect(body.doc.content?.[0].content).toHaveLength(2);
    expect(body.fontSize).toBeCloseTo(28); // 28pt at 50% autofit
    const second = body.doc.content![0].content![1].content![0].content![0];
    expect(second.marks).toEqual([{ type: "italic" }]);
  });

  it("imports pictures as assets and shapes with theme colors", () => {
    const [pic] = byKind(s1.elements, "image");
    expect(pic).toMatchObject({ x: 1000, y: 500, w: 200, h: 100 });
    expect([...stored[pic.asset]]).toEqual([137, 80, 78, 71]);
    const ellipse = byKind(s1.elements, "shape").find((s) => s.shape === "ellipse")!;
    expect(ellipse.rotation).toBe(90);
    expect(ellipse.fill).not.toBe("#4472c4"); // darkened by lumMod
    const arrow = byKind(s1.elements, "shape").find((s) => s.shape === "arrow")!;
    expect(arrow.stroke).toEqual({ color: "#ff0000", width: 4 });
    expect(arrow.w).toBeCloseTo(100);
  });

  it("reads notes and counts what it could not convert", () => {
    expect(s1.notes).toBe("Saludar\nMostrar la gráfica");
    expect(skipped).toEqual({});
  });

  it("imports tables with their header and banding", () => {
    const [table] = byKind(s1.elements, "table");
    expect(table.rows).toEqual([
      ["Calibre", "dB"],
      [".22 LR", "94,5"],
    ]);
    expect(table).toMatchObject({ headerRow: true, striped: true, fontSize: 28 });
  });

  it("keeps explicit run formatting, alignment and line breaks", () => {
    const [box] = byKind(s2.elements, "text");
    expect(box).toMatchObject({ x: 100, y: 100, color: "#c00000", align: "right" });
    expect(box.fontSize).toBeCloseTo(48);
    expect(texts(box.doc)).toBe("Hola\nmundo");
    expect(box.doc.content?.[0].content?.[0].marks).toEqual([
      { type: "bold" },
      { type: "underline" },
    ]);
  });
});

describe("helpers", () => {
  it("resolves relative part paths", () => {
    expect(resolvePath("ppt/slides/", "../media/image1.png")).toBe("ppt/media/image1.png");
    expect(resolvePath("ppt/", "/ppt/slides/slide1.xml")).toBe("ppt/slides/slide1.xml");
  });

  it("converts diagonal lines to a rotated horizontal line through the same center", () => {
    const g = lineGeometry({ x: 0, y: 0, w: 300, h: 400, rotation: 0 }, false, false);
    expect(g.w).toBeCloseTo(500);
    expect(g.x + g.w / 2).toBeCloseTo(150);
    expect(g.y + g.h / 2).toBeCloseTo(200);
    expect(g.rotation).toBeCloseTo(53.13, 1);
    expect(
      lineGeometry({ x: 0, y: 0, w: 300, h: 400, rotation: 0 }, false, true).rotation,
    ).toBeCloseTo(306.87, 1);
  });
});
