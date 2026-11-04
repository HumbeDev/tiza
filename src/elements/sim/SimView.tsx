import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Element, SimElement } from "../../document";
import { isDesktop } from "../../files/platform";
import { type RenderMode, isStill } from "../../render/mode";
import { useSimReloads } from "./reload";
import { injectCsp } from "./csp";

type SimEl = Element & { kind: "sim" } & SimElement;

interface Props {
  el: SimEl;
  mode: RenderMode;
  /** When false, clicks go to the canvas (select/move) instead of the page. */
  interactive: boolean;
}

/**
 * Embedded HTML page in a sandboxed iframe (scripts allowed, no access to Tiza or other
 * origins). The page lays out at `viewWidth × viewHeight` and is scaled into the box.
 */
export default function SimView({ el, mode, interactive }: Props) {
  if (isStill(mode)) {
    return (
      <div className="sim-placeholder">
        <span className="sim-placeholder-icon">{"</>"}</span>
        <span>{el.title}</span>
      </div>
    );
  }
  return <SimFrame el={el} interactive={interactive} />;
}

function SimFrame({ el, interactive }: { el: SimEl; interactive: boolean }) {
  const reloads = useSimReloads((s) => s.counts[el.id] ?? 0);
  const src = useSimUrl(el.html, el.allowNetwork);
  const sx = el.w / el.viewWidth;
  const sy = el.h / el.viewHeight;
  const s = Math.min(sx, sy);
  const [scaleX, scaleY] = el.fit === "fill" ? [sx, sy] : [s, s];
  const offsetX = (el.w - el.viewWidth * scaleX) / 2;
  const offsetY = (el.h - el.viewHeight * scaleY) / 2;

  return (
    <div className="sim-view">
      {(src !== null || !isDesktop) && (
        <iframe
          key={reloads}
          title={el.title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          {...(isDesktop
            ? { src: src ?? undefined }
            : { srcDoc: injectCsp(el.html, el.allowNetwork) })}
          style={{
            width: el.viewWidth,
            height: el.viewHeight,
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`,
            pointerEvents: interactive ? "auto" : "none",
          }}
        />
      )}
      {/* WebKitGTK may never paint the iframe unless another layer overlaps it. */}
      <div className="sim-paint-layer" aria-hidden="true" />
    </div>
  );
}

/** Desktop: the page is served by Rust under `tizasim://` with its own CSP. */
function useSimUrl(html: string, allowNetwork: boolean): string | null {
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null);
  const key = `${allowNetwork ? 1 : 0}:${html}`;

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    // Debounce while the HTML is being typed.
    const timer = setTimeout(() => {
      invoke<string>("register_sim", { html, allowNetwork }).then(
        (id) => !cancelled && setUrl({ key, url: convertFileSrc(id, "tizasim") }),
        () => {},
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [html, allowNetwork, key]);

  return url?.url ?? null;
}
