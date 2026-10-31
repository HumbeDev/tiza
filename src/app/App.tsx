import Canvas from "../canvas/Canvas";
import PropertiesPanel from "./PropertiesPanel";
import SlidePanel from "./SlidePanel";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";
import { useShortcuts } from "./useShortcuts";

export default function App() {
  useShortcuts();
  return (
    <div className="editor">
      <Toolbar />
      <SlidePanel />
      <main className="canvas-area">
        <Canvas />
      </main>
      <PropertiesPanel />
      <StatusBar />
    </div>
  );
}
