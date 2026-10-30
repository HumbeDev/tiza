import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setLanguage } from "../i18n";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, isLanguage } from "../i18n/languages";

export default function App() {
  const { t, i18n } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("app_version")
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  return (
    <main className="welcome">
      <h1>{t("app.hello")}</h1>
      <p className="tagline">{t("app.tagline")}</p>

      <label className="language-picker">
        {t("app.language")}
        <select
          value={i18n.language}
          onChange={(e) => isLanguage(e.target.value) && void setLanguage(e.target.value)}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_NAMES[lang]}
            </option>
          ))}
        </select>
      </label>

      <p className="status">
        {version ? t("app.backendVersion", { version }) : t("app.backendUnavailable")}
      </p>
    </main>
  );
}
