import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { createEmbed } from "../document/factory";
import { embedSrc, embedThumbnail, parseEmbed } from "../elements/embed/parse";
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
  const { t, i18n } = useTranslation();
  const [url, setUrl] = useState("");
  const parsed = parseEmbed(url);
  const thumb = parsed && embedThumbnail(parsed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function insert() {
    if (!parsed) return;
    const { width, height } = useEditor.getState().doc.page;
    addElement(createEmbed(parsed, parsed.link, width / 2, height / 2));
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
          <textarea
            className="embed-url"
            rows={3}
            autoFocus
            spellCheck={false}
            aria-label={t("embed.link")}
            placeholder={t("embed.placeholder")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                insert();
              }
            }}
          />
          <p className={parsed || !url.trim() ? "embed-status" : "embed-status error"}>
            {parsed
              ? t(`embed.${parsed.provider}`)
              : url.trim()
                ? t("embed.invalid")
                : t("embed.supported")}
          </p>
          {thumb && <img className="embed-preview" src={thumb} alt="" />}
          {parsed?.provider === "x" && (
            <iframe
              className="embed-preview-post"
              title={parsed.link}
              src={embedSrc(parsed, i18n.language.slice(0, 2))}
              sandbox="allow-scripts allow-same-origin"
            />
          )}
          {!parsed && (
            <ul className="embed-howto">
              <li>
                <strong>X:</strong> {t("embed.howX")}
              </li>
              <li>
                <strong>YouTube:</strong> {t("embed.howYoutube")}
              </li>
              <li>
                <strong>{t("embed.web")}:</strong> {t("embed.howWeb")}
              </li>
            </ul>
          )}
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
