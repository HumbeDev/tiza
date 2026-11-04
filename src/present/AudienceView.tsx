import { useCallback, useEffect, useState } from "react";
import type { PresentClient } from "./client";
import SlideStage from "./SlideStage";
import { usePresentation } from "./usePresentation";
import { type LaserPos } from "./client";
import { slidePosition, useLaserToggle, useRemoteLaser } from "./laser";

/** What the audience sees: the slide, fullscreen. Click = next, right click = previous. */
export default function AudienceView({ client }: { client: PresentClient }) {
  const { snapshot, status, current } = usePresentation(client);
  const [cursorHidden, setCursorHidden] = useState(false);
  // L here: the mouse itself is the laser (single screen). From the presenter view: remote.
  const [ownLaser, setOwnLaser] = useState(false);
  const [ownPos, setOwnPos] = useState<LaserPos | null>(null);
  const remote = useRemoteLaser(client);
  useLaserToggle(useCallback(() => setOwnLaser((on) => !on), []));

  // Hide the mouse pointer when it stops moving.
  useEffect(() => {
    let timer = setTimeout(() => setCursorHidden(true), 2000);
    const onMove = () => {
      setCursorHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setCursorHidden(true), 2000);
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  if (!snapshot || !status) return <div className="audience" />;
  return (
    <div
      className={cursorHidden || ownLaser ? "audience no-cursor" : "audience"}
      onPointerMove={ownLaser ? (e) => setOwnPos(slidePosition(e)) : undefined}
      onPointerLeave={() => setOwnPos(null)}
      onClick={(e) => {
        // Tables, videos and pages are used with the mouse; clicking them doesn't advance.
        if (!(e.target as HTMLElement).closest("[data-interactive]")) client.nav({ kind: "next" });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        client.nav({ kind: "prev" });
      }}
    >
      <SlideStage
        slide={current}
        page={snapshot.doc.page}
        mode="present"
        animate
        step={status.step}
        laser={ownLaser ? ownPos : remote}
      />
      {status.blank !== "none" && <div className={`blank-screen ${status.blank}`} />}
    </div>
  );
}
