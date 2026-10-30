export const SUPPORTED_LANGUAGES = ["es", "pt-BR", "fr", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: Language = "en";

/** Native names, shown in the language picker regardless of the current UI language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  es: "Español",
  "pt-BR": "Português (Brasil)",
  fr: "Français",
  en: "English",
};

export function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Picks the best supported language for a list of BCP 47 tags in order of preference
 * (e.g. `navigator.languages`). Any Portuguese variant maps to pt-BR.
 */
export function pickLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    if (isLanguage(tag)) return tag;
    const base = tag.toLowerCase().split("-")[0];
    if (base === "pt") return "pt-BR";
    if (isLanguage(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}
