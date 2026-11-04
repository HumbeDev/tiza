// Recently opened or saved files (desktop: paths can be reopened). Kept per machine in
// localStorage, most recent first.
import { create } from "zustand";

export interface RecentFile {
  name: string;
  path: string;
}

const KEY = "tiza.recentFiles";
const MAX = 8;

function load(): RecentFile[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(list)
      ? list.filter(
          (f): f is RecentFile => typeof f?.path === "string" && typeof f?.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export const useRecentFiles = create<RecentFile[]>(load);

function store(list: RecentFile[]) {
  useRecentFiles.setState(list, true);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Not persisted; the list still works for this session.
  }
}

export function addRecentFile(file: { name: string | null; path: string | null }): void {
  if (!file.path) return;
  const entry = { name: file.name ?? file.path, path: file.path };
  store([entry, ...useRecentFiles.getState().filter((f) => f.path !== file.path)].slice(0, MAX));
}

export function removeRecentFile(path: string): void {
  store(useRecentFiles.getState().filter((f) => f.path !== path));
}

export function clearRecentFiles(): void {
  store([]);
}

/** "~/Documents/Physics" style folder for menu labels. */
export function folderOf(path: string, home?: string): string {
  const dir = path.replace(/[\\/][^\\/]*$/, "");
  return home && dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}
