import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ptBR from "./locales/pt-BR.json";
import { FALLBACK_LANGUAGE, type Language, isLanguage, pickLanguage } from "./languages";

const STORAGE_KEY = "tiza.language";

export const resources = {
  es: { translation: es },
  "pt-BR": { translation: ptBR },
  fr: { translation: fr },
  en: { translation: en },
} as const;

// TODO(fase-2): persist the language in the Rust-side settings instead of localStorage.
function storedLanguage(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function setLanguage(language: Language): Promise<unknown> {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable: the choice just won't survive a restart.
  }
  return i18n.changeLanguage(language);
}

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage() ?? pickLanguage(navigator.languages),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;

export default i18n;
