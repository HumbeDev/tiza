import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../app/Icon";
import type { PresentClient } from "./client";
import SlideStage from "./SlideStage";
import { usePresentation } from "./usePresentation";

const NOTES_SIZE_KEY = "tiza.notesSize";

function readNotesSize(): number {
  try {
    return Number(localStorage.getItem(NOTES_SIZE_KEY)) || 22;
  } catch {
    return 22;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const formatElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

/** The speaker's screen: current and next slide, notes, timer and clock. */
export default function PresenterView({ client }: { client: PresentClient }) {
  const { t } = useTranslation();
  const { snapshot, status, slides, current } = usePresentation(client);
  const [now, setNow] = useState(() => Date.now());
  const [timer, setTimer] = useState(() => ({
    start: Date.now(),
    pausedAt: null as number | null,
  }));
  const [notesSize, setNotesSize] = useState(readNotesSize);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  function changeNotesSize(delta: number) {
    const size = Math.min(48, Math.max(12, notesSize + delta));
    setNotesSize(size);
    try {
      localStorage.setItem(NOTES_SIZE_KEY, String(size));
    } catch {
      // Not remembered.
    }
  }

  const elapsed = (timer.pausedAt ?? now) - timer.start;
  const togglePause = () =>
    setTimer((tm) =>
      tm.pausedAt === null
        ? { ...tm, pausedAt: Date.now() }
        : { start: tm.start + (Date.now() - tm.pausedAt), pausedAt: null },
    );

  if (!snapshot || !status) return <div className="presenter loading">{t("present.loading")}</div>;
  const next = slides[status.index + 1];
  const clock = new Date(now).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="presenter">
      <header className="presenter-bar">
        <div className="timer" title={t("present.timer")}>
          <span className={timer.pausedAt !== null ? "paused" : undefined}>
            {formatElapsed(elapsed)}
          </span>
          <button type="button" className="tool-button" onClick={togglePause}>
            {timer.pausedAt !== null ? t("present.resume") : t("present.pause")}
          </button>
          <button
            type="button"
            className="tool-button"
            onClick={() =>
              setTimer({ start: Date.now(), pausedAt: timer.pausedAt === null ? null : Date.now() })
            }
          >
            {t("present.reset")}
          </button>
        </div>
        <div className="slide-counter">
          {t("status.slideOf", { current: status.index + 1, total: status.count })}
        </div>
        <div className="clock">{clock}</div>
        <div className="presenter-actions">
          <button
            type="button"
            className="tool-button"
            aria-label={t("present.prev")}
            onClick={() => client.nav({ kind: "prev" })}
          >
            <Icon name="arrowUp" /> {t("present.prev")}
          </button>
          <button
            type="button"
            className="tool-button"
            aria-label={t("present.next")}
            onClick={() => client.nav({ kind: "next" })}
          >
            {t("present.next")} <Icon name="arrowDown" />
          </button>
          <button
            type="button"
            className={status.blank === "black" ? "tool-button active" : "tool-button"}
            title="B"
            onClick={() => client.nav({ kind: "black" })}
          >
            {t("present.black")}
          </button>
          <button
            type="button"
            className={status.blank === "white" ? "tool-button active" : "tool-button"}
            title="W"
            onClick={() => client.nav({ kind: "white" })}
          >
            {t("present.white")}
          </button>
          <button
            type="button"
            className="small-button danger"
            title="Esc"
            onClick={() => client.end()}
          >
            {t("present.end")}
          </button>
        </div>
      </header>

      <main className="presenter-main">
        <section className="presenter-current">
          <SlideStage slide={current} page={snapshot.doc.page} mode="preview" />
          {status.blank !== "none" && (
            <div className="blank-badge">{t(`present.${status.blank}Showing`)}</div>
          )}
        </section>
        <aside className="presenter-side">
          <h2>{t("present.nextSlide")}</h2>
          <div className="presenter-next">
            {next ? (
              <SlideStage slide={next} page={snapshot.doc.page} mode="thumb" />
            ) : (
              <p className="end-of-show">{t("present.endOfShow")}</p>
            )}
          </div>
          <h2 className="notes-heading">
            {t("notes.title")}
            <span className="notes-size">
              <button
                type="button"
                className="tool-button"
                onClick={() => changeNotesSize(-2)}
                aria-label="A−"
              >
                A−
              </button>
              <button
                type="button"
                className="tool-button"
                onClick={() => changeNotesSize(2)}
                aria-label="A+"
              >
                A+
              </button>
            </span>
          </h2>
          <div className="presenter-notes" style={{ fontSize: notesSize }}>
            {current?.notes.trim() ? (
              current.notes
            ) : (
              <span className="muted">{t("present.noNotes")}</span>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
