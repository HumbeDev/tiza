import { lazy, Suspense } from "react";
import type { Element, TextElement } from "../document";
import RichText from "./text/RichText";

// TipTap only loads when a text box is first edited.
const TextEditor = lazy(() => import("./text/TextEditor"));

type Props = { el: Element & { kind: "text" } & TextElement; editing: boolean };

export default function TextView({ el, editing }: Props) {
  const style = { fontSize: el.fontSize, color: el.color, textAlign: el.align };
  return (
    <div className="text-view" style={style}>
      {editing ? (
        <Suspense fallback={<RichText doc={el.doc} />}>
          <TextEditor el={el} />
        </Suspense>
      ) : (
        <RichText doc={el.doc} />
      )}
    </div>
  );
}
