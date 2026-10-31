import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { isDesktop } from "../files/platform";
import { invoke } from "@tauri-apps/api/core";
import type { GpuPreference } from "../bindings/GpuPreference";
import type { GpuReport } from "../bindings/GpuReport";
import { platform } from "../files/platform";
import { restartApp } from "../files/session";
import { diagnosticsText, gpuInUse, gpuInfo, systemGpus } from "./diagnostics";
import Icon from "./Icon";
import LanguagePicker from "./LanguagePicker";
import { THEMES, setTheme, useTheme } from "./theme";

const useSettings = create<{ open: boolean }>(() => ({ open: false }));
export const openSettings = () => useSettings.setState({ open: true });
const closeSettings = () => useSettings.setState({ open: false });

export const THEME_ICONS = { system: "monitor", light: "sun", dark: "moon" } as const;

export default function SettingsDialog() {
  const open = useSettings((s) => s.open);
  if (!open) return null;
  return <Dialog />;
}

function Dialog() {
  const { t } = useTranslation();
  const theme = useTheme((s) => s.pref);
  const gpu = useMemo(() => gpuInfo(), []);
  const [system, setSystem] = useState<GpuReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [gpuPref, setGpuPref] = useState<GpuPreference | null>(null);
  const inUse = gpuInUse(system);
  const primary = system?.devices.find((d) => d.primary);
  const dedicated = system?.devices.find((d) => !d.primary);
  const isWindows = /Windows/i.test(navigator.userAgent);
  const canChooseGpu = isDesktop && ((system?.devices.length ?? 0) > 1 || isWindows);

  useEffect(() => {
    void systemGpus().then(setSystem);
    if (isDesktop) {
      invoke<GpuPreference>("get_gpu_preference").then(setGpuPref, () => setGpuPref("default"));
    }
  }, []);

  async function changeGpu(preference: GpuPreference) {
    const ok = await platform.confirm(
      t("settings.restartQuestion"),
      t("settings.restart"),
      t("file.cancel"),
    );
    if (!ok) return;
    await invoke("set_gpu_preference", { preference });
    setGpuPref(preference);
    await restartApp();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSettings();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(diagnosticsText(gpu, system));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && closeSettings()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
        <header className="modal-header">
          <h2>{t("settings.title")}</h2>
          <button
            type="button"
            className="tool-button"
            aria-label={t("settings.close")}
            onClick={closeSettings}
          >
            ✕
          </button>
        </header>

        <section className="modal-section">
          <h3>{t("app.language")}</h3>
          <LanguagePicker />
        </section>

        <section className="modal-section">
          <h3>{t("settings.theme")}</h3>
          <div className="segmented" role="radiogroup" aria-label={t("settings.theme")}>
            {THEMES.map((pref) => (
              <button
                key={pref}
                type="button"
                role="radio"
                aria-checked={theme === pref}
                className={theme === pref ? "active" : undefined}
                onClick={() => setTheme(pref)}
              >
                <Icon name={THEME_ICONS[pref]} /> {t(`settings.themes.${pref}`)}
              </button>
            ))}
          </div>
        </section>

        {canChooseGpu && (
          <section className="modal-section">
            <h3>
              {t("settings.gpuChoice")}
              <HelpTip text={t("settings.gpuHelp")} />
            </h3>
            <select
              value={gpuPref ?? "default"}
              disabled={gpuPref === null}
              onChange={(e) => void changeGpu(e.target.value as GpuPreference)}
            >
              <option value="default">
                {t("settings.gpuDefault")}
                {primary ? ` — ${primary.name}` : ""}
              </option>
              <option value="highPerformance">
                {t("settings.gpuHigh")}
                {dedicated ? ` — ${dedicated.name}` : ""}
              </option>
            </select>
          </section>
        )}

        <section className="modal-section">
          <h3>{t("settings.diagnostics")}</h3>
          <dl className="diagnostics">
            <dt>{t("settings.version")}</dt>
            <dd>
              {__APP_VERSION__} · {t(isDesktop ? "settings.desktop" : "settings.web")}
            </dd>
            {system && system.devices.length > 0 && (
              <>
                <dt>{t("settings.gpus")}</dt>
                <dd>
                  <ul className="gpu-list">
                    {system.devices.map((d, i) => (
                      <li key={i}>
                        {d.vendor} · {d.name}
                        {d.driver && <span className="muted"> ({d.driver})</span>}
                        {d.primary && <span className="tag">{t("settings.primary")}</span>}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            )}
            {inUse && (
              <>
                <dt>{t("settings.inUse")}</dt>
                <dd className="ok">{inUse.name}</dd>
              </>
            )}
            <dt>{t("settings.webEngine")}</dt>
            <dd>
              {gpu.renderer ?? t("settings.unknown")}
              {gpu.masked && <span className="muted"> — {t("settings.masked")}</span>}
            </dd>
            {!gpu.masked && (
              <>
                <dt>{t("settings.acceleration")}</dt>
                <dd className={gpu.software ? "warn" : "ok"}>
                  {gpu.software ? t("settings.software") : t("settings.hardware")}
                </dd>
              </>
            )}
            <dt>WebGL</dt>
            <dd>
              {gpu.webgl ? "WebGL ✓" : "WebGL ✗"} · {gpu.webgl2 ? "WebGL 2 ✓" : "WebGL 2 ✗"}
            </dd>
          </dl>
          <button type="button" className="small-button" onClick={copy}>
            <Icon name="copy" /> {copied ? t("settings.copied") : t("settings.copy")}
          </button>
        </section>
      </div>
    </div>
  );
}

/** A small (?) that shows `text` on hover or keyboard focus. */
function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      ?
      <span className="help-tip-text" role="tooltip">
        {text}
      </span>
    </span>
  );
}
