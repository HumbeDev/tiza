// Insert actions shared by the ribbon and menus. They place new elements at the center of
// the current slide.
import pendulum from "../../examples/pendulo.html?raw";
import { pickImage, pickVideo } from "../assets/store";
import type { ShapeKind } from "../document";
import {
  createImage,
  createShape,
  createSim,
  createTable,
  createText,
  createVideo,
} from "../document/factory";
import { parseCsv } from "../elements/table/csv";
import { platform } from "../files/platform";
import { showFileError } from "../files/session";
import i18n from "../i18n";
import { addElement, insertMath, openHtmlEditor, startEditing, useEditor } from "../store/editor";

const t = i18n.t.bind(i18n);

function center() {
  const { width, height } = useEditor.getState().doc.page;
  return { cx: width / 2, cy: height / 2 };
}

async function guarded(action: () => Promise<void>) {
  try {
    await action();
  } catch (e) {
    await showFileError(e);
  }
}

export function insertText() {
  const { cx, cy } = center();
  const el = createText(t("canvas.defaultText"), cx, cy);
  addElement(el);
  startEditing(el.id);
}

export async function insertEquation() {
  const { cx, cy } = center();
  startEditing(await insertMath(String.raw`E = mc^2`, cx, cy));
}

export function insertShape(shape: ShapeKind) {
  const { cx, cy } = center();
  addElement(createShape(shape, cx, cy));
}

export const insertImage = () =>
  guarded(async () => {
    const picked = await pickImage();
    const { cx, cy } = center();
    if (picked) addElement(createImage(picked.name, picked, cx, cy));
  });

export const insertVideo = () =>
  guarded(async () => {
    const picked = await pickVideo();
    const { cx, cy } = center();
    if (picked) addElement(createVideo(picked.name, cx, cy));
  });

export function insertEmptyTable() {
  const { cx, cy } = center();
  const header = [1, 2, 3].map((n) => t("table.column", { n }));
  addElement(createTable([header, ["", "", ""], ["", "", ""]], cx, cy));
}

export const insertCsvTable = () =>
  guarded(async () => {
    const file = await platform.pickCsvFile();
    if (!file) return;
    const rows = parseCsv(file.text);
    const { cx, cy } = center();
    if (rows.length) addElement(createTable(rows, cx, cy));
  });

export function insertHtml() {
  const { cx, cy } = center();
  const el = createSim(pendulum, t("sim.exampleTitle"), cx, cy);
  addElement(el);
  openHtmlEditor(el.id);
}
