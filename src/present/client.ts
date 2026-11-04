// Talks to the running presentation. Desktop: Rust owns the state and broadcasts it as an
// event to all windows. Web: the editor tab owns it (fullscreen in that tab) and a
// presenter pop-up syncs through a BroadcastChannel.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { NavAction } from "../bindings/NavAction";
import type { PresentSnapshot } from "../bindings/PresentSnapshot";
import type { PresentStatus } from "../bindings/PresentStatus";
import type { Presentation, Slide } from "../document";
import { isDesktop } from "../files/platform";

export type { NavAction, PresentSnapshot, PresentStatus };

export const visibleSlides = (doc: Presentation): Slide[] => doc.slides.filter((s) => !s.hidden);

/** Build steps of each visible slide. Same as `build_steps` in src-tauri/src/present.rs. */
export const buildSteps = (doc: Presentation): number[] =>
  visibleSlides(doc).map((s) =>
    Math.max(0, ...s.elements.flatMap((e) => [e.build?.step ?? 0, e.exit?.step ?? 0])),
  );

/** Same rules as `PresentStatus::apply` in src-tauri/src/present.rs. */
export function applyNav(status: PresentStatus, action: NavAction, steps: number[]): PresentStatus {
  const last = Math.max(0, status.count - 1);
  const stepsOf = (i: number) => steps[i] ?? 0;
  if (action.kind === "black" || action.kind === "white") {
    return { ...status, blank: status.blank === action.kind ? "none" : action.kind };
  }
  let { index, step } = status;
  if (action.kind === "next") {
    if (step < stepsOf(index)) step += 1;
    else if (index < last) [index, step] = [index + 1, 0];
  } else if (action.kind === "prev") {
    if (step > 0) step -= 1;
    else if (index > 0) [index, step] = [index - 1, stepsOf(index - 1)];
  } else if (action.kind === "first") [index, step] = [0, 0];
  else if (action.kind === "last") [index, step] = [last, 0];
  else [index, step] = [Math.min(action.index, last), 0];
  return { ...status, index, step, blank: "none" };
}

export interface PresentClient {
  snapshot(): Promise<PresentSnapshot | null>;
  nav(action: NavAction): void;
  end(): void;
  onStatus(cb: (status: PresentStatus) => void): () => void;
  /** Called when the presentation ends from another window. */
  onEnded(cb: () => void): () => void;
}

// ---------------------------------------------------------------- desktop

const desktopClient: PresentClient = {
  snapshot: () => invoke<PresentSnapshot | null>("presentation_snapshot"),
  nav: (action) => void invoke("present_nav", { action }),
  end: () => void invoke("end_presentation"),
  onStatus(cb) {
    const off = listen<PresentStatus>("present:status", (e) => cb(e.payload));
    return () => void off.then((f) => f());
  },
  onEnded(cb) {
    const off = listen("present:ended", () => cb());
    return () => void off.then((f) => f());
  },
};

// ---------------------------------------------------------------- web

type Message =
  | { type: "hello" }
  | { type: "snapshot"; snapshot: PresentSnapshot }
  | { type: "status"; status: PresentStatus }
  | { type: "nav"; action: NavAction }
  | { type: "end" };

const channel: BroadcastChannel | null =
  !isDesktop && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("tiza-present")
    : null;
const post = (m: Message) => channel?.postMessage(m);

/** The running web presentation, owned by the editor tab. */
export const useWebPresentation = create<{ snapshot: PresentSnapshot | null }>(() => ({
  snapshot: null,
}));

const isHostTab = !location.hash;

function webNav(action: NavAction) {
  const snapshot = useWebPresentation.getState().snapshot;
  if (!snapshot) return;
  const status = applyNav(snapshot.status, action, snapshot.steps);
  useWebPresentation.setState({ snapshot: { ...snapshot, status } });
  post({ type: "status", status });
}

function webEnd() {
  if (!useWebPresentation.getState().snapshot) return;
  useWebPresentation.setState({ snapshot: null });
  post({ type: "end" });
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

channel?.addEventListener("message", (e: MessageEvent<Message>) => {
  if (!isHostTab) return;
  const snapshot = useWebPresentation.getState().snapshot;
  if (e.data.type === "hello" && snapshot) post({ type: "snapshot", snapshot });
  else if (e.data.type === "nav") webNav(e.data.action);
  else if (e.data.type === "end") webEnd();
});

/** The audience view inside the editor tab. */
const webHostClient: PresentClient = {
  snapshot: () => Promise.resolve(useWebPresentation.getState().snapshot),
  nav: webNav,
  end: webEnd,
  onStatus: (cb) =>
    useWebPresentation.subscribe((s, prev) => {
      if (s.snapshot && s.snapshot.status !== prev.snapshot?.status) cb(s.snapshot.status);
    }),
  onEnded: (cb) => useWebPresentation.subscribe((s, prev) => !s.snapshot && prev.snapshot && cb()),
};

/** The presenter pop-up, a separate tab of the web version. */
const webRemoteClient: PresentClient = {
  snapshot() {
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent<Message>) => {
        if (e.data.type !== "snapshot") return;
        channel?.removeEventListener("message", onMessage);
        resolve(e.data.snapshot);
      };
      channel?.addEventListener("message", onMessage);
      post({ type: "hello" });
      setTimeout(() => resolve(null), 3000);
    });
  },
  nav: (action) => post({ type: "nav", action }),
  end: () => post({ type: "end" }),
  onStatus(cb) {
    const h = (e: MessageEvent<Message>) => e.data.type === "status" && cb(e.data.status);
    channel?.addEventListener("message", h);
    return () => channel?.removeEventListener("message", h);
  },
  onEnded(cb) {
    const h = (e: MessageEvent<Message>) => e.data.type === "end" && cb();
    channel?.addEventListener("message", h);
    return () => channel?.removeEventListener("message", h);
  },
};

export const presentClient: PresentClient = isDesktop
  ? desktopClient
  : isHostTab
    ? webHostClient
    : webRemoteClient;

// ---------------------------------------------------------------- starting

/**
 * Starts presenting `doc` at visible slide `start`. Desktop opens the audience window on
 * the external screen and the presenter view on the main one (`rehearse`: two windows).
 * Web: fullscreen in this tab.
 */
export async function startPresentation(
  doc: Presentation,
  start: number,
  rehearse: boolean,
): Promise<void> {
  const count = visibleSlides(doc).length;
  if (count === 0) return;
  if (isDesktop) {
    await invoke("start_presentation", {
      doc,
      start,
      rehearse,
      audienceScreen: getAudienceScreen(),
    });
    return;
  }
  const status: PresentStatus = {
    index: Math.min(start, count - 1),
    count,
    step: 0,
    blank: "none",
  };
  useWebPresentation.setState({ snapshot: { doc, status, steps: buildSteps(doc) } });
  if (!rehearse) await document.documentElement.requestFullscreen?.().catch(() => {});
}

/** Web: opens the presenter view in a new window (drag it to the other screen). */
export function openWebPresenterView(): void {
  window.open(`${location.pathname}#presenter`, "tiza-presenter", "popup,width=1280,height=760");
}

const AUDIENCE_SCREEN_KEY = "tiza.audienceScreen";

/** Screen the user picked for the audience (desktop); null = automatic (external). */
export function getAudienceScreen(): string | null {
  try {
    return localStorage.getItem(AUDIENCE_SCREEN_KEY);
  } catch {
    return null;
  }
}

export function setAudienceScreen(name: string | null): void {
  try {
    if (name) localStorage.setItem(AUDIENCE_SCREEN_KEY, name);
    else localStorage.removeItem(AUDIENCE_SCREEN_KEY);
  } catch {
    // Not persisted; the automatic choice is used.
  }
}
