// Right-click menus for elements, the empty canvas and slide thumbnails.
import i18n from "../../i18n";
import {
  addBlankSlide,
  buildOnNextClick,
  setBuild,
  addSlide,
  copySelected,
  currentSlide,
  cutSelected,
  deleteSelected,
  deleteSlide,
  duplicateSelected,
  duplicateSlide,
  hasClipboard,
  moveSlide,
  openHtmlEditor,
  paste,
  reorderSelected,
  selectAll,
  selectSlide,
  selectedElements,
  setLocked,
  groupElements,
  ungroupElements,
  setSlideHidden,
  setHideMaster,
  editMaster,
  setTemplateSlide,
  startEditing,
  useEditor,
} from "../../store/editor";
import { type MenuItem, separator } from "./Menu";

const t = i18n.t.bind(i18n);
const state = useEditor.getState;

export function elementMenu(): MenuItem[] {
  const selected = selectedElements(state());
  const single = selected.length === 1 ? selected[0] : null;
  const allLocked = selected.every((e) => e.locked);
  const edit: MenuItem[] = [];
  if (single?.kind === "text" || single?.kind === "math") {
    edit.push({
      label: t("menu.edit"),
      icon: "edit",
      shortcut: "Enter",
      onSelect: () => startEditing(single.id),
    });
  } else if (single?.kind === "embed") {
    edit.push({ label: t("sim.interact"), icon: "play", onSelect: () => startEditing(single.id) });
  } else if (single?.kind === "table" || single?.kind === "video") {
    edit.push({
      label: t(single.kind === "table" ? "table.editCells" : "video.play"),
      icon: "edit",
      onSelect: () => startEditing(single.id),
    });
  } else if (single?.kind === "sim") {
    edit.push(
      { label: t("sim.editHtml"), icon: "html", onSelect: () => openHtmlEditor(single.id) },
      { label: t("sim.interact"), icon: "play", onSelect: () => startEditing(single.id) },
    );
  }
  return [
    ...edit,
    ...(edit.length ? [separator] : []),
    { label: t("menu.cut"), icon: "cut", shortcut: "Ctrl+X", onSelect: cutSelected },
    { label: t("menu.copy"), icon: "copy", shortcut: "Ctrl+C", onSelect: copySelected },
    {
      label: t("menu.paste"),
      icon: "paste",
      shortcut: "Ctrl+V",
      disabled: !hasClipboard(),
      onSelect: () => paste(),
    },
    { label: t("menu.duplicate"), icon: "copy", shortcut: "Ctrl+D", onSelect: duplicateSelected },
    separator,
    {
      label: t("zorder.front"),
      icon: "front",
      shortcut: "Ctrl+Shift+]",
      onSelect: () => reorderSelected("front"),
    },
    { label: t("zorder.forward"), shortcut: "Ctrl+]", onSelect: () => reorderSelected("forward") },
    {
      label: t("zorder.backward"),
      shortcut: "Ctrl+[",
      onSelect: () => reorderSelected("backward"),
    },
    {
      label: t("zorder.back"),
      icon: "back",
      shortcut: "Ctrl+Shift+[",
      onSelect: () => reorderSelected("back"),
    },
    ...(selected.length > 1 &&
    !selected.every((e) => e.groupId && e.groupId === selected[0].groupId)
      ? [
          {
            label: t("menu.group"),
            icon: "group" as const,
            shortcut: "Ctrl+G",
            onSelect: () => groupElements(state().selectedIds),
          },
        ]
      : []),
    ...(selected.some((e) => e.groupId)
      ? [
          {
            label: t("menu.ungroup"),
            icon: "ungroup" as const,
            shortcut: "Ctrl+Shift+G",
            onSelect: () => ungroupElements(state().selectedIds),
          },
        ]
      : []),
    separator,
    { label: t("build.onNextClick"), icon: "build", onSelect: buildOnNextClick },
    ...(selected.some((e) => e.build)
      ? [{ label: t("build.remove"), onSelect: () => setBuild(state().selectedIds, null) }]
      : []),
    separator,
    {
      label: t(allLocked ? "menu.unlock" : "menu.lock"),
      icon: allLocked ? "unlock" : "lock",
      onSelect: () => setLocked(state().selectedIds, !allLocked),
    },
    separator,
    {
      label: t("props.delete"),
      icon: "trash",
      shortcut: "Supr",
      danger: true,
      onSelect: deleteSelected,
    },
  ];
}

export function canvasMenu(): MenuItem[] {
  const empty = currentSlide(state()).elements.length === 0;
  return [
    {
      label: t("menu.paste"),
      icon: "paste",
      shortcut: "Ctrl+V",
      disabled: !hasClipboard(),
      onSelect: () => paste(),
    },
    {
      label: t("menu.selectAll"),
      icon: "selectAll",
      shortcut: "Ctrl+A",
      disabled: empty,
      onSelect: selectAll,
    },
    separator,
    { label: t("toolbar.newSlide"), icon: "slideAdd", shortcut: "Ctrl+M", onSelect: addSlide },
  ];
}

export function slideMenu(slideId: string): MenuItem[] {
  const { doc } = state();
  const slides = doc.slides;
  const index = slides.findIndex((s) => s.id === slideId);
  const slide = slides[index];
  if (!slide) return [];
  return [
    {
      label: t("toolbar.newSlide"),
      icon: "slideAdd",
      onSelect: () => {
        selectSlide(slideId);
        addSlide();
      },
    },
    ...(doc.template
      ? [
          {
            label: t("slides.newBlank"),
            onSelect: () => {
              selectSlide(slideId);
              addBlankSlide();
            },
          },
        ]
      : []),
    { label: t("slides.duplicate"), icon: "copy", onSelect: () => duplicateSlide(slideId) },
    { label: t("slides.useAsTemplate"), onSelect: () => setTemplateSlide(slideId) },
    ...(doc.template
      ? [{ label: t("slides.removeTemplate"), onSelect: () => setTemplateSlide(null) }]
      : []),
    {
      label: t(slide.hidden ? "slides.show" : "slides.hide"),
      icon: slide.hidden ? "eye" : "eyeOff",
      onSelect: () => setSlideHidden(slideId, !slide.hidden),
    },
    ...(doc.master
      ? [
          {
            label: t("master.showHere"),
            checked: !slide.hideMaster,
            onSelect: () => setHideMaster([slideId], !slide.hideMaster),
          },
        ]
      : []),
    { label: t("master.edit"), icon: "master" as const, onSelect: editMaster },
    separator,
    {
      label: t("slides.moveUp"),
      icon: "arrowUp",
      disabled: index === 0,
      onSelect: () => moveSlide(index, index - 1),
    },
    {
      label: t("slides.moveDown"),
      icon: "arrowDown",
      disabled: index === slides.length - 1,
      onSelect: () => moveSlide(index, index + 1),
    },
    separator,
    {
      label: t("slides.delete"),
      icon: "trash",
      danger: true,
      disabled: slides.length <= 1,
      onSelect: () => deleteSlide(slideId),
    },
  ];
}
