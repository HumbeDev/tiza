import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import type { Page, Slide } from "../document";
import SlideRenderer, { type RenderMode } from "../render/SlideRenderer";

interface Props {
  slide: Slide | undefined;
  page: Page;
  mode: RenderMode;
  /** Play the slide's transition when it appears. */
  animate?: boolean;
}

/** A slide scaled to fit its container, centered, letterboxed on black. */
export default function SlideStage({ slide, page, mode, animate }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(size.w / page.width, size.h / page.height) || 0;
  const transition = animate ? slide?.transition : undefined;
  const style = transition
    ? ({ animationDuration: `${transition.durationMs}ms` } as CSSProperties)
    : undefined;

  return (
    <div className="slide-stage" ref={ref}>
      {slide && scale > 0 && (
        <div
          key={slide.id}
          className={transition ? `stage-slide transition-${transition.kind}` : "stage-slide"}
          style={{ width: page.width * scale, height: page.height * scale, ...style }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <SlideRenderer slide={slide} page={page} mode={mode} />
          </div>
        </div>
      )}
    </div>
  );
}
