import type { ReactNode } from "react";
import type { RichMark, RichNode } from "../../document";
import { InlineMathSvg } from "../math/MathSvg";

/** Static rendering of a TipTap document (thumbnails, presentation, non-editing canvas). */
export default function RichText({ doc }: { doc: RichNode }) {
  return <div className="rich-text">{renderChildren(doc)}</div>;
}

function renderChildren(node: RichNode): ReactNode[] {
  return (node.content ?? []).map((child, i) => renderNode(child, i));
}

function renderNode(node: RichNode, key: number): ReactNode {
  switch (node.type) {
    case "paragraph": {
      const align = node.attrs?.textAlign;
      return (
        <p key={key} style={typeof align === "string" ? { textAlign: align as "left" } : undefined}>
          {node.content?.length ? renderChildren(node) : <br />}
        </p>
      );
    }
    case "bulletList":
      return <ul key={key}>{renderChildren(node)}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(node.attrs?.start ?? 1)}>
          {renderChildren(node)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderChildren(node)}</li>;
    case "hardBreak":
      return <br key={key} />;
    case "inlineMath":
      return <InlineMathSvg key={key} latex={String(node.attrs?.latex ?? "")} />;
    case "text":
      return (node.marks ?? []).reduce<ReactNode>(wrapMark, <span key={key}>{node.text}</span>);
    default:
      return <span key={key}>{renderChildren(node)}</span>;
  }
}

function wrapMark(inner: ReactNode, mark: RichMark): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{inner}</strong>;
    case "italic":
      return <em>{inner}</em>;
    case "underline":
      return <u>{inner}</u>;
    case "strike":
      return <s>{inner}</s>;
    case "code":
      return <code>{inner}</code>;
    case "textStyle": {
      const { color, fontSize } = mark.attrs ?? {};
      const style = {
        ...(typeof color === "string" ? { color } : {}),
        ...(typeof fontSize === "string" ? { fontSize } : {}),
      };
      return <span style={style}>{inner}</span>;
    }
    default:
      return inner;
  }
}
