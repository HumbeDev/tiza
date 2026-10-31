import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, type NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMath } from "../../math/useMath";
import { InlineMathSvg } from "../math/MathSvg";

export const INLINE_MATH_INPUT = /(?:^|\s)\$([^$\s](?:[^$\n]*[^$\s])?)\$$/;

/** `$…$` formula inside rich text. Stored as `{ type: "inlineMath", attrs: { latex } }`. */
export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-latex") ?? "",
        renderHTML: (attrs) => ({ "data-latex": attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-inline-math]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-inline-math": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathNodeView, {
      stopEvent: ({ event }) => event.target instanceof HTMLInputElement,
    });
  },

  addInputRules() {
    const type = this.type;
    return [
      // `$…$` typed after a space or at the start of a line. Like Pandoc, the content can't
      // start or end with a space, so prices like "$5 and $10" stay text.
      new InputRule({
        find: INLINE_MATH_INPUT,
        handler: ({ state, range, match }) => {
          const start = range.from + match[0].indexOf("$");
          state.tr.replaceWith(start, range.to, type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});

function InlineMathNodeView({ node, selected, updateAttributes, editor, getPos }: NodeViewProps) {
  const { t } = useTranslation();
  const latex = String(node.attrs.latex);
  const { error } = useMath(latex, false);
  const input = useRef<HTMLInputElement>(null);
  // Opens when the node gets selected and stays open while typing: each keystroke replaces
  // the node (updateAttributes), which drops ProseMirror's node selection.
  const [open, setOpen] = useState(false);
  const [wasSelected, setWasSelected] = useState(false);
  if (selected !== wasSelected) {
    setWasSelected(selected);
    if (selected && editor.isEditable) setOpen(true);
  }
  const showPopover = open;

  // ProseMirror keeps focus while it selects the node; take it once the popover is shown.
  useEffect(() => {
    if (!showPopover) return;
    const frame = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [showPopover]);

  function leave() {
    setOpen(false);
    const pos = getPos();
    if (typeof pos === "number")
      editor
        .chain()
        .focus()
        .setTextSelection(pos + node.nodeSize)
        .run();
  }

  return (
    <NodeViewWrapper
      as="span"
      className={selected ? "inline-math-node selected" : "inline-math-node"}
    >
      <InlineMathSvg latex={latex} />
      {showPopover && (
        <span className="inline-math-popover" contentEditable={false}>
          <input
            ref={input}
            value={latex}
            spellCheck={false}
            placeholder={t("math.placeholder")}
            onChange={(e) => updateAttributes({ latex: e.target.value })}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                leave();
              }
            }}
          />
          {error && <span className="popover-error">{error}</span>}
        </span>
      )}
    </NodeViewWrapper>
  );
}
