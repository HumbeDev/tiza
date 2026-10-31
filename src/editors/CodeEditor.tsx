import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { useEffect, useLayoutEffect, useRef } from "react";
import { latexCompletions } from "./latexCompletions";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  placeholderText?: string;
  autoFocus?: boolean;
}

export default function LatexCodeEditor({
  value,
  onChange,
  onDone,
  placeholderText,
  autoFocus,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onDone });
  useLayoutEffect(() => {
    callbacks.current = { onChange, onDone };
  });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          closeBrackets(),
          bracketMatching(),
          autocompletion({ override: [latexCompletions] }),
          StreamLanguage.define(stex),
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.lineWrapping,
          placeholder(placeholderText ?? ""),
          keymap.of([
            { key: "Escape", run: () => (callbacks.current.onDone?.(), true) },
            { key: "Mod-Enter", run: () => (callbacks.current.onDone?.(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) callbacks.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => v.destroy();
    // The editor is created once; later `value` changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div className="latex-code-editor" ref={host} />;
}
