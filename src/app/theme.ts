import { create } from "zustand";

export type ThemePref = "system" | "light" | "dark";
export const THEMES: ThemePref[] = ["system", "light", "dark"];

const KEY = "tiza.theme";

function stored(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
}

/** UI theme. A per-user preference, so it lives in local storage, not in the document. */
export const useTheme = create<{ pref: ThemePref }>(() => ({ pref: stored() }));
apply(useTheme.getState().pref);

export function setTheme(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Not persisted; still applies for this session.
  }
  apply(pref);
  useTheme.setState({ pref });
}
