import { create } from "zustand";
import type { ExportFormat } from "../files/platform";

/** Progress of the running export, for the status overlay. */
export const useExportProgress = create<{ done: number; total: number } | null>(() => null);

export interface ExportResult {
  bytes: Uint8Array;
  format: ExportFormat;
}

export async function withProgress<T>(total: number, run: (tick: () => void) => Promise<T>) {
  let done = 0;
  useExportProgress.setState({ done, total }, true);
  try {
    return await run(() => useExportProgress.setState({ done: ++done, total }, true));
  } finally {
    useExportProgress.setState(null, true);
  }
}
