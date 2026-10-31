import type { Editor } from "@tiptap/core";
import { create } from "zustand";

/** The TipTap editor of the text box being edited, for the formatting controls. */
export const useActiveTextEditor = create<{ editor: Editor | null }>(() => ({ editor: null }));
