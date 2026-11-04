import { invoke } from "@tauri-apps/api/core";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { configureMcp, setMcpEnabled, useMcpStatus } from "../agent/mcpStatus";
import type { AgentClient } from "../bindings/AgentClient";
import type { AgentClientStatus } from "../bindings/AgentClientStatus";
import type { GpuPreference } from "../bindings/GpuPreference";
import type { GpuReport } from "../bindings/GpuReport";
import { isDesktop, platform } from "../files/platform";
import { restartApp } from "../files/session";
import { diagnosticsText, gpuInUse, gpuInfo, systemGpus } from "./diagnostics";
import Icon, { type IconName } from "./Icon";
import LanguagePicker from "./LanguagePicker";
import { THEMES, setTheme, useTheme } from "./theme";

type Section = "general" | "performance" | "agents" | "diagnostics" | "about";

const useSettings = create<{ open: boolean; section: Section }>(() => ({
  open: false,
  section: "general",
}));
export const openSettings = (section?: Section) =>
  useSettings.setState((s) => ({ open: true, section: section ?? s.section }));
const closeSettings = () => useSettings.setState({ open: false });

export const THEME_ICONS = { system: "monitor", light: "sun", dark: "moon" } as const;

const SECTIONS: [Section, IconName][] = [
  ["general", "settings"],
  ["performance", "monitor"],
  ["agents", "build"],
  ["diagnostics", "selectAll"],
  ["about", "check"],
];

export default function SettingsDialog() {
  const open = useSettings((s) => s.open);
  if (!open) return null;
  return <Dialog />;
}

function errorText(e: unknown): string {
  return typeof e === "object" && e && "detail" in e
    ? String((e as { detail: unknown }).detail)
    : String(e);
}

function Dialog() {
  const { t } = useTranslation();
  const section = useSettings((s) => s.section);
  const sections = SECTIONS.filter(
    ([id]) => isDesktop || (id !== "performance" && id !== "agents"),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSettings();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && closeSettings()}
    >
      <div
        className="modal settings"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
      >
        <nav className="settings-nav" aria-label={t("settings.title")}>
          <h2>{t("settings.title")}</h2>
          {sections.map(([id, icon]) => (
            <button
              key={id}
              type="button"
              className={section === id ? "settings-nav-item active" : "settings-nav-item"}
              aria-current={section === id}
              onClick={() => useSettings.setState({ section: id })}
            >
              <Icon name={icon} />
              {t(`settings.sections.${id}`)}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          <header className="settings-header">
            <h3>{t(`settings.sections.${section}`)}</h3>
            <button
              type="button"
              className="tool-button"
              aria-label={t("settings.close")}
              onClick={closeSettings}
            >
              ✕
            </button>
          </header>
          <div className="settings-content">
            {section === "general" && <GeneralSection />}
            {section === "performance" && <PerformanceSection />}
            {section === "agents" && <AgentsSection />}
            {section === "diagnostics" && <DiagnosticsSection />}
            {section === "about" && <AboutSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        {label}
        {help && <HelpTip text={help} />}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- general

function GeneralSection() {
  const { t } = useTranslation();
  const theme = useTheme((s) => s.pref);
  return (
    <>
      <Row label={t("app.language")}>
        <LanguagePicker />
      </Row>
      <Row label={t("settings.theme")}>
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
      </Row>
    </>
  );
}

// ---------------------------------------------------------------- performance

function PerformanceSection() {
  const { t } = useTranslation();
  const [system, setSystem] = useState<GpuReport | null>(null);
  const [gpuPref, setGpuPref] = useState<GpuPreference | null>(null);
  const primary = system?.devices.find((d) => d.primary);
  const dedicated = system?.devices.find((d) => !d.primary);
  const inUse = gpuInUse(system);
  const canChoose = (system?.devices.length ?? 0) > 1 || /Windows/i.test(navigator.userAgent);

  useEffect(() => {
    void systemGpus().then(setSystem);
    invoke<GpuPreference>("get_gpu_preference").then(setGpuPref, () => setGpuPref("default"));
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

  return (
    <>
      <Row label={t("settings.gpuChoice")} help={t("settings.gpuHelp")}>
        {canChoose ? (
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
        ) : (
          <span className="muted">{t("settings.singleGpu")}</span>
        )}
      </Row>
      {inUse && (
        <Row label={t("settings.inUse")}>
          <span className="ok-text">{inUse.name}</span>
        </Row>
      )}
    </>
  );
}

// ---------------------------------------------------------------- AI agents

const CLIENTS: { id: AgentClient; name: string; how: string }[] = [
  { id: "claudeCode", name: "Claude Code", how: "agents.how.claudeCode" },
  { id: "codex", name: "Codex", how: "agents.how.codex" },
  { id: "antigravity", name: "Antigravity", how: "agents.how.antigravity" },
];

function AgentsSection() {
  const { t } = useTranslation();
  const status = useMcpStatus((s) => s.status);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [clients, setClients] = useState<AgentClientStatus[]>([]);

  const refresh = useCallback(() => {
    invoke<AgentClientStatus[]>("mcp_clients").then(setClients, () => setClients([]));
  }, []);
  useEffect(refresh, [refresh, status?.token, status?.port]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    }
    refresh();
  }

  if (!status) return null;
  return (
    <>
      <p className="settings-intro">{t("mcp.help")}</p>
      <div className="settings-card">
        <label className="switch-row">
          <input
            type="checkbox"
            checked={status.enabled}
            onChange={(e) => void run(() => setMcpEnabled(e.target.checked))}
          />
          <span>
            <strong>{t("mcp.enable")}</strong>
            <span className={status.running ? "ok-text" : status.enabled ? "warn-text" : "muted"}>
              {status.running
                ? t("mcp.running", { port: status.port })
                : status.enabled
                  ? t("mcp.stopped")
                  : t("mcp.off")}
            </span>
          </span>
        </label>
        {status.enabled && (
          <div className="mcp-row">
            <label className="number-field">
              <span className="field-label">{t("mcp.port")}</span>
              <input
                type="number"
                defaultValue={status.port}
                min={1024}
                max={65535}
                onBlur={(e) => {
                  const port = e.target.valueAsNumber;
                  if (Number.isFinite(port) && port !== status.port)
                    void run(() => configureMcp(port, false));
                }}
              />
            </label>
            <label className="number-field mcp-token">
              <span className="field-label">
                {t("mcp.token")}
                <HelpTip text={t("mcp.tokenHelp")} />
              </span>
              <span className="token-row">
                <input
                  readOnly
                  value={showToken ? status.token : "•".repeat(24)}
                  onFocus={() => setShowToken(true)}
                />
                <button
                  type="button"
                  className="small-button"
                  onClick={() => void run(() => configureMcp(null, true))}
                >
                  {t("mcp.newToken")}
                </button>
              </span>
            </label>
          </div>
        )}
      </div>

      {status.enabled && (
        <>
          <h4 className="settings-subtitle">{t("agents.title")}</h4>
          <div className="agent-list">
            {CLIENTS.map((c) => (
              <AgentCard
                key={c.id}
                client={c}
                status={clients.find((s) => s.client === c.id)}
                onRun={run}
              />
            ))}
          </div>
        </>
      )}
      {error && <p className="hint error">{error}</p>}
    </>
  );
}

function AgentCard({
  client,
  status,
  onRun,
}: {
  client: (typeof CLIENTS)[number];
  status?: AgentClientStatus;
  onRun: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const state = !status
    ? "unknown"
    : status.configured
      ? "connected"
      : status.installed
        ? "notConfigured"
        : "notInstalled";

  async function copy() {
    if (!status) return;
    await navigator.clipboard.writeText(status.manual);
    setCopied(true);
  }

  return (
    <div className="agent-card">
      <div className="agent-card-head">
        <strong>{client.name}</strong>
        <span className={`chip ${state}`}>{t(`agents.state.${state}`)}</span>
      </div>
      <p className="hint">
        {t(`agents.how.${client.id}`)}
        {status && <code className="path">{status.configPath}</code>}
      </p>
      <div className="button-row wrap">
        <button
          type="button"
          className={status?.configured ? "small-button" : "small-button primary"}
          onClick={() => void onRun(() => invoke("mcp_install_client", { client: client.id }))}
        >
          {status?.configured ? t("agents.reconfigure") : t("agents.configure")}
        </button>
        <button type="button" className="small-button" onClick={() => void copy()}>
          <Icon name="copy" />{" "}
          {copied
            ? t("settings.copied")
            : t(client.id === "claudeCode" ? "agents.copyCommand" : "agents.copyConfig")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- diagnostics and about

function DiagnosticsSection() {
  const { t } = useTranslation();
  const gpu = useMemo(() => gpuInfo(), []);
  const [system, setSystem] = useState<GpuReport | null>(null);
  const [copied, setCopied] = useState(false);
  const inUse = gpuInUse(system);

  useEffect(() => {
    void systemGpus().then(setSystem);
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
    <>
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
    </>
  );
}

function AboutSection() {
  const { t } = useTranslation();
  return (
    <div className="about">
      <p className="about-name">Tiza {__APP_VERSION__}</p>
      <p>{t("about.tagline")}</p>
      <p className="muted">{t("about.license")}</p>
      <p>
        <a href="https://github.com/HumbeDev/tiza" target="_blank" rel="noreferrer">
          github.com/HumbeDev/tiza
        </a>
      </p>
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
