import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve("0.1.0")),
}));

afterEach(async () => {
  cleanup();
  await act(() => i18n.changeLanguage("en"));
});

describe("App", () => {
  it("greets and shows the backend version", async () => {
    await act(() => i18n.changeLanguage("en"));
    render(<App />);
    expect(screen.getByRole("heading").textContent).toBe("Hello, Tiza");
    expect(await screen.findByText("Rust core: version 0.1.0")).toBeTruthy();
  });

  it("switches language from the picker", async () => {
    await act(() => i18n.changeLanguage("en"));
    render(<App />);
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "pt-BR" } });
    });
    expect(screen.getByRole("heading").textContent).toBe("Olá, Tiza");
    expect(document.documentElement.lang).toBe("pt-BR");
  });
});
