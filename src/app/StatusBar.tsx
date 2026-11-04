import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDesktop } from "../files/platform";
import { untitled } from "../files/session";
import { useAgentActivity } from "../agent/executor";
import { useMcpStatus } from "../agent/mcpStatus";
import { isDirty, useEditor } from "../store/editor";

const RELEASES_URL = "https://github.com/HumbeDev/tiza/releases/latest";

export default function StatusBar() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const total = useEditor((s) => s.doc.slides.length);
  const index = useEditor((s) => s.doc.slides.findIndex((sl) => sl.id === s.currentSlideId));
  const fileName = useEditor((s) => s.file.name);
  const dirty = useEditor(isDirty);
  const mcp = useMcpStatus((s) => s.status);
  const agentAt = useAgentActivity((s) => s.lastAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!mcp?.running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mcp?.running]);
  const agentWorking = now - agentAt < 4000;

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
      {mcp?.running && (
        <span
          className={agentWorking ? "mcp-badge working" : "mcp-badge"}
          title={t("mcp.statusHint", { port: mcp.port })}
        >
          {agentWorking ? t("mcp.working") : t("mcp.listening")}
        </span>
      )}
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
