import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../assets/store";
import type { Element, VideoElement } from "../document";
import type { RenderMode } from "../render/SlideRenderer";

type Props = {
  el: Element & { kind: "video" } & VideoElement;
  mode: RenderMode;
  interactive: boolean;
};

/**
 * Editor: shows a frame; double-click to play it there. Presentation: plays with controls
 * (autoplay if set) and clicking it doesn't advance the slide. Thumbnails: a placeholder.
 */
export default function VideoView({ el, mode, interactive }: Props) {
  if (mode === "thumb") {
    return (
      <div className="video-placeholder">
        <span>▶</span>
      </div>
    );
  }
  return <VideoPlayer el={el} mode={mode} interactive={interactive} />;
}

function VideoPlayer({ el, mode, interactive }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const live = mode === "present" || interactive;
  const start = el.start ?? 0;

  useEffect(() => {
    let alive = true;
    mediaUrl(el.asset).then(
      (url) => alive && setSrc(url),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [el.asset]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    if (mode === "present" && el.autoplay) void video.play().catch(() => {});
    if (!live) video.pause();
  }, [mode, el.autoplay, live, src]);

  function onTimeUpdate() {
    const video = ref.current;
    if (!video || el.end === undefined || video.currentTime < el.end) return;
    if (el.loop) video.currentTime = start;
    else video.pause();
  }

  return (
    <div className="video-view" data-interactive={live ? "" : undefined}>
      <video
        ref={ref}
        // The media fragment shows the first frame of the chosen part before playing.
        src={src ? `${src}#t=${Math.max(start, 0.05)}` : undefined}
        preload="metadata"
        playsInline
        muted={el.muted || mode === "preview"}
        loop={el.loop && el.end === undefined}
        controls={live}
        onTimeUpdate={onTimeUpdate}
        style={{ pointerEvents: live ? "auto" : "none" }}
      />
    </div>
  );
}
