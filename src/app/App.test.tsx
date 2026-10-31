import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPresentation } from "../document/factory";
import i18n from "../i18n";
import { currentSlide, loadDocument, useEditor } from "../store/editor";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn((cmd: string) => Promise.resolve(cmd === "app_version" ? "0.1.0" : null)),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setTitle: () => Promise.resolve(),
    onCloseRequested: () => Promise.resolve(() => {}),
  }),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(async () => {
  loadDocument(createPresentation("Test", "en"));
  await act(() => i18n.changeLanguage("en"));
});

afterEach(cleanup);

describe("App", () => {
  it("shows the editor and the backend version", async () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(await screen.findByText("Rust core 0.1.0")).toBeTruthy();
    expect(screen.getByText("Slide 1 of 1")).toBeTruthy();
  });

  it("shows unsaved changes in the title and status bar", async () => {
    render(<App />);
    expect(document.title).toBe("Untitled — Tiza");
    fireEvent.click(screen.getByRole("button", { name: "Shapes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Ellipse" }));
    expect(document.title).toBe("● Untitled — Tiza");
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(document.title).toBe("Untitled — Tiza");
  });

  it("switches language from the settings dialog", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
        target: { value: "pt-BR" },
      });
    });
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("inserts a shape and undoes it with the keyboard", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Shapes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rectangle" }));
    expect(currentSlide(useEditor.getState()).elements).toHaveLength(1);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(currentSlide(useEditor.getState()).elements).toHaveLength(0);
  });

  it("cycles the theme from the toolbar", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /^Theme: System/ });
    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: /^Theme: Light/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /^Theme: Dark/ }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("opens the File menu", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    expect(screen.getByRole("menuitem", { name: /Save as/ })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("hides a slide from its context menu and undoes it", () => {
    const { container } = render(<App />);
    const thumb = container.querySelector(".slide-item")!;
    fireEvent.contextMenu(thumb, { clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide in presentation" }));
    expect(useEditor.getState().doc.slides[0].hidden).toBe(true);
    expect(container.querySelector(".hidden-slide")).toBeTruthy();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(useEditor.getState().doc.slides[0].hidden).toBe(false);
  });

  it("adds a slide from the toolbar", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "New slide" })[0]);
    expect(screen.getByText("Slide 2 of 2")).toBeTruthy();
  });
});
