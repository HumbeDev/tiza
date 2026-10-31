import { create } from "zustand";

/** Per-element reload counters: bumping one remounts that simulation's iframe. */
export const useSimReloads = create<{ counts: Record<string, number> }>(() => ({ counts: {} }));

export function reloadSim(id: string): void {
  useSimReloads.setState((s) => ({ counts: { ...s.counts, [id]: (s.counts[id] ?? 0) + 1 } }));
}
