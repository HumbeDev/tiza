import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { createEmbed } from "../document/factory";
import { embedThumbnail, parseEmbedUrl } from "../elements/embed/parse";
import { addElement, useEditor } from "../store/editor";

const useEmbedDialog = create<{ open: boolean }>(() => ({ open: false }));

export const openEmbedDialog = () => useEmbedDialog.setState({ open: true });
const close = () => useEmbedDialog.setState({ open: false });

/** Asks for a YouTube or X link and inserts it at the center of the current slide. */
export default function EmbedDialog() {
  const open = useEmbedDialog((s) => s.open);
  return open ? <Dialog /> : null;
}

function Dialog() {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const parsed = parseEmbedUrl(url);
  const thumb = parsed && embedThumbnail(parsed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function insert() {
    if (!parsed) return;
    const { width, height } = useEditor.getState().doc.page;
    addElement(createEmbed(parsed, url.trim(), width / 2, height / 2));
    close();
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <form
        className="modal embed-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("embed.title")}
        onSubmit={(e) => {
          e.preventDefault();
          insert();
        }}
      >
        <header className="modal-header">
          <h2>{t("embed.title")}</h2>
        </header>
        <div className="modal-section">
          <p className="hint">{t("embed.help")}</p>
          <input
            type="url"
            className="embed-url"
            autoFocus
            aria-label={t("embed.link")}
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className={parsed || !url.trim() ? "embed-status" : "embed-status error"}>
            {parsed
              ? t(`embed.${parsed.provider}`)
              : url.trim()
                ? t("embed.invalid")
                : t("embed.supported")}
          </p>
          {thumb && <img className="embed-preview" src={thumb} alt="" />}
          <p className="hint">{t("embed.online")}</p>
        </div>
        <footer className="modal-actions">
          <button type="button" className="small-button" onClick={close}>
            {t("file.cancel")}
          </button>
          <button type="submit" className="small-button primary" disabled={!parsed}>
            {t("embed.insert")}
          </button>
        </footer>
      </form>
    </div>
  );
}
