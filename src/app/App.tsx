import { lazy, Suspense, useEffect } from "react";
import Canvas from "../canvas/Canvas";
import { listenForAgents } from "../agent/executor";
import { refreshMcpStatus } from "../agent/mcpStatus";
import { isDesktop } from "../files/platform";
import { startSession } from "../files/session";
import { currentSlide, useEditor } from "../store/editor";
import PropertiesPanel from "./PropertiesPanel";
import SlidePanel from "./SlidePanel";
import { ContextMenuHost } from "./menu/Menu";
import NotesPanel from "./NotesPanel";
import WebPresentation from "../present/WebPresentation";
import { useEndOfPresentation } from "../present/startFromEditor";
import SettingsDialog from "./SettingsDialog";
import StatusBar from "./StatusBar";
import Ribbon from "./ribbon/Ribbon";
import { useShortcuts } from "./useShortcuts";

const MathEditorPanel = lazy(() => import("../editors/MathEditorPanel"));
const HtmlEditorPanel = lazy(() => import("../editors/HtmlEditorPanel"));

export default function App() {
  useShortcuts();
  useEffect(() => startSession(), []);
  useEffect(() => {
    if (!isDesktop) return;
    void refreshMcpStatus();
    const off = listenForAgents();
    return () => void off.then((f) => f());
  }, []);
  useEndOfPresentation();
  return (
    <div className="editor">
      <Ribbon />
      <SlidePanel />
      <main className="canvas-area">
        <div className="canvas-wrap">
          <Canvas />
          <MathEditorHost />
          <HtmlEditorHost />
        </div>
        <NotesPanel />
      </main>
      <PropertiesPanel />
      <StatusBar />
      <ContextMenuHost />
      <WebPresentation />
      <SettingsDialog />
    </div>
  );
}

function MathEditorHost() {
  const el = useEditor((s) =>
    s.editingId ? currentSlide(s).elements.find((e) => e.id === s.editingId) : undefined,
  );
  if (el?.kind !== "math") return null;
  return (
    <Suspense fallback={null}>
      <MathEditorPanel key={el.id} id={el.id} latex={el.latex} />
    </Suspense>
  );
}

function HtmlEditorHost() {
  const el = useEditor((s) =>
    s.htmlEditingId ? currentSlide(s).elements.find((e) => e.id === s.htmlEditingId) : undefined,
  );
  if (el?.kind !== "sim") return null;
  return (
    <Suspense fallback={null}>
      <HtmlEditorPanel id={el.id} html={el.html} />
    </Suspense>
  );
}
