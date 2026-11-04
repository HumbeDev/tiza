//! MCP server so AI agents (Claude Code, Claude Desktop…) can edit the open presentation
//! (PROYECTO.md §7.11). Off by default; listens on 127.0.0.1 only and requires a token.

mod bridge;
pub mod clients;
mod tools;

use std::sync::{Arc, Mutex};

use axum::extract::{Request, State};
use axum::http::{StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use rmcp::transport::streamable_http_server::{
    StreamableHttpServerConfig, StreamableHttpService, session::local::LocalSessionManager,
};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};
use tokio_util::sync::CancellationToken;
use ts_rs::TS;

pub use bridge::Bridge;

use crate::error::{AppError, AppResult};
use crate::settings::{self, McpSettings};

#[derive(Default)]
pub struct McpServer {
    pub bridge: Bridge,
    running: Mutex<Option<(u16, CancellationToken)>>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct McpStatus {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
    pub token: String,
    /// Ready-to-paste command for Claude Code.
    pub claude_command: String,
}

/// Compares in constant time so the token can't be guessed byte by byte.
pub fn token_matches(sent: &str, expected: &str) -> bool {
    !expected.is_empty()
        && sent.len() == expected.len()
        && sent
            .bytes()
            .zip(expected.bytes())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0
}

async fn require_token(State(token): State<Arc<String>>, request: Request, next: Next) -> Response {
    let sent = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or_default();
    if !token_matches(sent, &token) {
        return (StatusCode::UNAUTHORIZED, "Tiza: missing or wrong token").into_response();
    }
    next.run(request).await
}

impl McpServer {
    fn is_running(&self) -> Option<u16> {
        self.running
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .as_ref()
            .map(|(p, _)| *p)
    }

    pub fn stop(&self) {
        if let Some((_, cancel)) = self
            .running
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
        {
            cancel.cancel();
        }
    }

    pub async fn start(&self, config: &McpSettings) -> AppResult<()> {
        self.stop();
        let cancel = CancellationToken::new();
        let bridge = self.bridge.clone();
        let service: StreamableHttpService<tools::TizaMcp, LocalSessionManager> =
            StreamableHttpService::new(
                move || Ok(tools::TizaMcp::new(bridge.clone())),
                Default::default(),
                StreamableHttpServerConfig::default()
                    .with_json_response(true)
                    .with_sse_keep_alive(None)
                    .with_cancellation_token(cancel.clone()),
            );
        let router = axum::Router::new().nest_service("/mcp", service).layer(
            middleware::from_fn_with_state(Arc::new(config.token.clone()), require_token),
        );
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", config.port)).await?;
        let shutdown = cancel.clone();
        tauri::async_runtime::spawn(async move {
            let _ = axum::serve(listener, router)
                .with_graceful_shutdown(async move { shutdown.cancelled_owned().await })
                .await;
        });
        *self.running.lock().unwrap_or_else(|e| e.into_inner()) = Some((config.port, cancel));
        Ok(())
    }

    fn status(&self) -> McpStatus {
        let config = settings::load().mcp;
        let url = format!("http://127.0.0.1:{}/mcp", config.port);
        McpStatus {
            running: self.is_running().is_some(),
            claude_command: format!(
                "claude mcp add --transport http tiza {url} --header \"Authorization: Bearer {}\"",
                config.token
            ),
            enabled: config.enabled,
            port: config.port,
            token: config.token,
        }
    }
}

/// Starts the server at launch when the user enabled it.
pub fn start_if_enabled(app: &AppHandle) {
    let server = app.state::<McpServer>();
    server.bridge.attach(app.clone());
    let config = settings::load().mcp;
    if !config.enabled || config.token.is_empty() {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app.state::<McpServer>().start(&config).await;
    });
}

// ---------------------------------------------------------------- commands

#[tauri::command]
pub fn mcp_status(server: tauri::State<'_, McpServer>) -> McpStatus {
    server.status()
}

#[tauri::command]
pub async fn mcp_set_enabled(app: AppHandle, enabled: bool) -> AppResult<McpStatus> {
    let mut all = settings::load();
    all.mcp.enabled = enabled;
    if all.mcp.token.is_empty() {
        all.mcp.token = settings::new_token();
    }
    settings::save(&all)?;
    let server = app.state::<McpServer>();
    if enabled {
        server.start(&all.mcp).await?;
    } else {
        server.stop();
    }
    Ok(server.status())
}

#[tauri::command]
pub async fn mcp_configure(
    app: AppHandle,
    port: Option<u16>,
    new_token: bool,
) -> AppResult<McpStatus> {
    let mut all = settings::load();
    if let Some(port) = port {
        if port < 1024 {
            return Err(AppError::InvalidDocument(
                "port must be 1024 or higher".into(),
            ));
        }
        all.mcp.port = port;
    }
    if new_token || all.mcp.token.is_empty() {
        all.mcp.token = settings::new_token();
    }
    settings::save(&all)?;
    let server = app.state::<McpServer>();
    if all.mcp.enabled {
        server.start(&all.mcp).await?;
    }
    Ok(server.status())
}

fn url_and_token() -> (String, String) {
    let config = settings::load().mcp;
    (
        format!("http://127.0.0.1:{}/mcp", config.port),
        config.token,
    )
}

/// Which agents are installed and whether they are already connected to Tiza.
#[tauri::command]
pub async fn mcp_clients() -> Vec<clients::AgentClientStatus> {
    let (url, token) = url_and_token();
    tauri::async_runtime::spawn_blocking(move || {
        [
            clients::AgentClient::ClaudeCode,
            clients::AgentClient::Codex,
            clients::AgentClient::Antigravity,
        ]
        .into_iter()
        .map(|c| clients::status(c, &url, &token))
        .collect()
    })
    .await
    .unwrap_or_default()
}

/// Connects an agent to Tiza by writing its configuration (see `clients.rs`).
#[tauri::command]
pub async fn mcp_install_client(client: clients::AgentClient) -> AppResult<String> {
    let (url, token) = url_and_token();
    tauri::async_runtime::spawn_blocking(move || clients::install(client, &url, &token))
        .await
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?
}

/// The editor's answer to an `mcp:request` event.
#[tauri::command]
pub fn mcp_respond(server: tauri::State<'_, McpServer>, id: u64, ok: bool, result: Value) {
    let reply = if ok {
        Ok(result)
    } else {
        Err(result
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| result.to_string()))
    };
    server.bridge.respond(id, reply);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_comparison() {
        assert!(token_matches("abc123", "abc123"));
        assert!(!token_matches("abc124", "abc123"));
        assert!(!token_matches("abc", "abc123"));
        assert!(!token_matches("", ""));
    }

    #[test]
    fn new_tokens_are_long_and_unique() {
        let a = settings::new_token();
        assert_eq!(a.len(), 64);
        assert_ne!(a, settings::new_token());
    }
}
