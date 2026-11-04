/**
 * edit: the editor canvas · thumb: thumbnails (no live pages) · present: the audience
 * (pages interactive) · preview: presenter view (pages live but not interactive) ·
 * export: a still picture for PDF/PNG (no live pages; hidden build steps not drawn).
 */
export type RenderMode = "edit" | "thumb" | "present" | "preview" | "export";

/** Modes that show still placeholders instead of live pages, videos and players. */
export const isStill = (mode: RenderMode) => mode === "thumb" || mode === "export";
