import { useTranslation } from "react-i18next";
import { setLanguage } from "../i18n";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, isLanguage } from "../i18n/languages";

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <select
      className="language-picker"
      aria-label={t("app.language")}
      title={t("app.language")}
      value={i18n.language}
      onChange={(e) => isLanguage(e.target.value) && void setLanguage(e.target.value)}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {LANGUAGE_NAMES[lang]}
        </option>
      ))}
    </select>
  );
}
