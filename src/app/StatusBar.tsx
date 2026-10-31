import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDesktop } from "../files/platform";
import { untitled } from "../files/session";
import { isDirty, useEditor } from "../store/editor";

const RELEASES_URL = "https://github.com/HumbeDev/tiza/releases/latest";

export default function StatusBar() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const total = useEditor((s) => s.doc.slides.length);
  const index = useEditor((s) => s.doc.slides.findIndex((sl) => sl.id === s.currentSlideId));
  const fileName = useEditor((s) => s.file.name);
  const dirty = useEditor(isDirty);

  useEffect(() => {
    if (!isDesktop) return;
    invoke<string>("app_version")
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  return (
    <footer className="status-bar">
      <span className="status-file">
        {fileName ?? untitled()} · {dirty ? t("status.unsaved") : t("status.saved")}
      </span>
      <span>{t("status.slideOf", { current: index + 1, total })}</span>
      {!isDesktop && (
        <a className="status-link" href={RELEASES_URL} target="_blank" rel="noreferrer">
          {t("status.download")}
        </a>
      )}
      <span>
        {!isDesktop
          ? t("status.webVersion", { version: __APP_VERSION__ })
          : version
            ? t("app.backendVersion", { version })
            : t("app.backendUnavailable")}
      </span>
    </footer>
  );
}
