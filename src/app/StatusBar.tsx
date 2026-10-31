import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditor } from "../store/editor";

export default function StatusBar() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const total = useEditor((s) => s.doc.slides.length);
  const index = useEditor((s) => s.doc.slides.findIndex((sl) => sl.id === s.currentSlideId));

  useEffect(() => {
    invoke<string>("app_version")
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  return (
    <footer className="status-bar">
      <span>{t("status.slideOf", { current: index + 1, total })}</span>
      <span>{version ? t("app.backendVersion", { version }) : t("app.backendUnavailable")}</span>
    </footer>
  );
}
