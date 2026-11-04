import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { McpStatus } from "../bindings/McpStatus";
import { isDesktop } from "../files/platform";

/** The MCP server's state as last reported by Rust (desktop only). */
export const useMcpStatus = create<{ status: McpStatus | null }>(() => ({ status: null }));

export async function refreshMcpStatus(): Promise<void> {
  if (!isDesktop) return;
  try {
    useMcpStatus.setState({ status: await invoke<McpStatus>("mcp_status") });
  } catch {
    useMcpStatus.setState({ status: null });
  }
}

export async function setMcpEnabled(enabled: boolean): Promise<void> {
  useMcpStatus.setState({ status: await invoke<McpStatus>("mcp_set_enabled", { enabled }) });
}

export async function configureMcp(port: number | null, newToken: boolean): Promise<void> {
  useMcpStatus.setState({ status: await invoke<McpStatus>("mcp_configure", { port, newToken }) });
}
