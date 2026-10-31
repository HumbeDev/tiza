import { useEffect, useRef, useState } from "react";
import { setPreamble } from "../math/mathjax";
import {
  type PresentClient,
  type PresentSnapshot,
  type PresentStatus,
  visibleSlides,
} from "./client";
import { keyAction } from "./keys";

/** Loads the snapshot, follows status changes and handles presentation keys. */
export function usePresentation(client: PresentClient) {
  const [snapshot, setSnapshot] = useState<PresentSnapshot | null>(null);
  const [status, setStatus] = useState<PresentStatus | null>(null);
  const typed = useRef("");

  useEffect(() => {
    let alive = true;
    void client.snapshot().then((s) => {
      if (!alive || !s) return;
      setPreamble(s.doc.latex.preamble);
      setSnapshot(s);
      setStatus(s.status);
    });
    const offStatus = client.onStatus(setStatus);
    return () => {
      alive = false;
      offStatus();
    };
  }, [client]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (/^[0-9]$/.test(e.key)) {
        typed.current = (typed.current + e.key).slice(-4);
        return;
      }
      const action = keyAction(e, typed.current);
      typed.current = "";
      if (!action) return;
      e.preventDefault();
      if (action === "end") client.end();
      else client.nav(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [client]);

  const slides = snapshot ? visibleSlides(snapshot.doc) : [];
  return { snapshot, status, slides, current: status ? slides[status.index] : undefined };
}
