import { assetUrl } from "../assets/store";
import type { Element, ImageElement } from "../document";

type Props = { el: Element & { kind: "image" } & ImageElement };

export default function ImageView({ el }: Props) {
  return (
    <img
      className="image-view"
      src={assetUrl(el.asset)}
      alt=""
      draggable={false}
      style={{ objectFit: el.fit }}
    />
  );
}
