import { useEffect } from "react";
import { presentClient } from "./client";
import AudienceView from "./AudienceView";
import PresenterView from "./PresenterView";

/** Root of the `#audience` and `#presenter` windows. */
export default function PresentWindow({ role }: { role: "audience" | "presenter" }) {
  useEffect(() => {
    document.title = role === "audience" ? "Tiza" : "Tiza — Presenter";
    // Web pop-up: close when the presentation ends in the editor tab.
    return presentClient.onEnded(() => window.close());
  }, [role]);
  return role === "audience" ? (
    <AudienceView client={presentClient} />
  ) : (
    <PresenterView client={presentClient} />
  );
}
