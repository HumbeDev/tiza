import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Element, EmbedElement } from "../../document";
import { type RenderMode, isStill } from "../../render/mode";
import { embedSrc, embedThumbnail } from "./parse";

type EmbedEl = Element & { kind: "embed" } & EmbedElement;

interface Props {
  el: EmbedEl;
  mode: RenderMode;
  /** When false, clicks go to the canvas (select/move) instead of the player. */
  interactive: boolean;
}

/**
 * YouTube video or X post in the service's own player (needs internet). Thumbnails and
 * the presenter's previews show a still picture so nothing plays twice.
 */
export default function EmbedView({ el, mode, interactive }: Props) {
  const { i18n } = useTranslation();
  if (isStill(mode) || mode === "preview") return <EmbedPlaceholder el={el} />;
  // Slides are 1920 units wide, so a post laid out at its natural pixel size would be
  // unreadable; lay it out smaller and scale it up. Videos fill any size.
  const zoom = el.provider === "x" ? 2 : 1;
  return (
    <div
      className={`sim-view embed-view embed-${el.provider}`}
      data-interactive={interactive ? "" : undefined}
    >
      <iframe
        title={el.url}
        src={embedSrc(el, i18n.language.slice(0, 2))}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
        style={{
          width: el.w / zoom,
          height: el.h / zoom,
          transform: zoom === 1 ? undefined : `scale(${zoom})`,
          pointerEvents: interactive ? "auto" : "none",
        }}
      />
      {/* WebKitGTK may never paint the iframe unless another layer overlaps it. */}
      <div className="sim-paint-layer" aria-hidden="true" />
    </div>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function EmbedPlaceholder({ el }: { el: EmbedEl }) {
  const [failed, setFailed] = useState(false);
  const thumb = embedThumbnail(el);
  return (
    <div className={`embed-placeholder embed-${el.provider}`}>
      {thumb && !failed && (
        <img src={thumb} alt="" draggable={false} onError={() => setFailed(true)} />
      )}
      {el.provider === "web" ? (
        <span className="embed-web">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
          </svg>
          {hostOf(el.media)}
        </span>
      ) : (
        <span className="embed-badge">{el.provider === "youtube" ? "▶" : "𝕏"}</span>
      )}
    </div>
  );
}
