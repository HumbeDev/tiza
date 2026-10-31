import { useEffect } from "react";
import { selectSlide, useEditor } from "../store/editor";
import { presentClient, startPresentation, visibleSlides } from "./client";

export type StartFrom = "beginning" | "current";

/** Starts presenting the editor's document. */
export async function presentFromEditor(from: StartFrom, rehearse = false): Promise<void> {
  const { doc, currentSlideId } = useEditor.getState();
  const visible = visibleSlides(doc);
  let start = 0;
  if (from === "current") {
    // From the current slide, or the next visible one if it is hidden.
    const all = doc.slides.findIndex((s) => s.id === currentSlideId);
    const next = doc.slides.slice(all).find((s) => !s.hidden);
    start = Math.max(0, next ? visible.indexOf(next) : visible.length - 1);
  }
  await startPresentation(doc, start, rehearse);
}

/** When a presentation ends, the editor shows the slide that was on screen. */
export function useEndOfPresentation(): void {
  useEffect(() => {
    let last = 0;
    const offStatus = presentClient.onStatus((s) => (last = s.index));
    const offEnded = presentClient.onEnded(() => {
      const slide = visibleSlides(useEditor.getState().doc)[last];
      if (slide) selectSlide(slide.id);
    });
    return () => {
      offStatus();
      offEnded();
    };
  }, []);
}
