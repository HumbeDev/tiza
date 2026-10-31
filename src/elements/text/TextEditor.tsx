import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor as useTiptap } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import type { Element, RichNode, TextElement } from "../../document";
import { stopEditing, updateElements } from "../../store/editor";
import { useActiveTextEditor } from "./activeEditor";
import { InlineMath } from "./inlineMath";

type Props = { el: Element & { kind: "text" } & TextElement };

export const textExtensions = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    codeBlock: false,
    horizontalRule: false,
    link: false,
  }),
  InlineMath,
];

export default function TextEditor({ el }: Props) {
  const editor = useTiptap({
    extensions: textExtensions,
    content: el.doc as JSONContent,
    autofocus: "all",
    editorProps: {
      attributes: { class: "rich-text text-editor" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          stopEditing();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) =>
      updateElements([el.id], { doc: editor.getJSON() as RichNode }, `text:${el.id}`),
  });

  useEffect(() => {
    useActiveTextEditor.setState({ editor });
    return () => useActiveTextEditor.setState({ editor: null });
  }, [editor]);

  return <EditorContent editor={editor} onPointerDown={(e) => e.stopPropagation()} />;
}
