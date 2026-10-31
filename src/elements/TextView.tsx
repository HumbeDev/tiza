import type { CSSProperties } from "react";
import type { Element, TextElement } from "../document";
import { stopEditing, updateElements } from "../store/editor";

type Props = { el: Element & { kind: "text" } & TextElement; editing: boolean };

export default function TextView({ el, editing }: Props) {
  const style: CSSProperties = {
    fontSize: el.fontSize,
    color: el.color,
    textAlign: el.align,
    fontWeight: el.bold ? 700 : 400,
    fontStyle: el.italic ? "italic" : "normal",
    lineHeight: 1.2,
  };

  if (editing) {
    return (
      <textarea
        className="text-editor"
        style={style}
        value={el.text}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => updateElements([el.id], { text: e.target.value }, `text:${el.id}`)}
        onBlur={stopEditing}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        }}
      />
    );
  }

  return (
    <div className="text-view" style={style}>
      {el.text}
    </div>
  );
}
