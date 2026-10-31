import { lazy, Suspense, useEffect } from "react";
import Canvas from "../canvas/Canvas";
import { startSession } from "../files/session";
import { currentSlide, useEditor } from "../store/editor";
import PropertiesPanel from "./PropertiesPanel";
import SlidePanel from "./SlidePanel";
import { ContextMenuHost } from "./menu/Menu";
import SettingsDialog from "./SettingsDialog";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";
import { useShortcuts } from "./useShortcuts";

const MathEditorPanel = lazy(() => import("../editors/MathEditorPanel"));
const HtmlEditorPanel = lazy(() => import("../editors/HtmlEditorPanel"));

export default function App() {
  useShortcuts();
  useEffect(() => startSession(), []);
  return (
    <div className="editor">
      <Toolbar />
      <SlidePanel />
      <main className="canvas-area">
        <Canvas />
        <MathEditorHost />
        <HtmlEditorHost />
      </main>
      <PropertiesPanel />
      <StatusBar />
      <ContextMenuHost />
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
