//! Connects AI agents installed on this computer (Claude Code, Codex, Antigravity) to
//! Tiza's MCP server by adding a `tiza` entry to their configuration. Only that entry is
//! touched, and the previous file is kept as `<file>.tiza-backup`.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use ts_rs::TS;

use crate::error::{AppError, AppResult};

pub const SERVER_NAME: &str = "tiza";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum AgentClient {
    ClaudeCode,
    Codex,
    Antigravity,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct AgentClientStatus {
    pub client: AgentClient,
    /// The program is installed (or its configuration folder exists).
    pub installed: bool,
    /// Its configuration already points at this Tiza with the current token.
    pub configured: bool,
    /// File where the entry lives.
    pub config_path: String,
    /// What to paste by hand: a command (Claude Code) or a config snippet.
    pub manual: String,
}

fn home() -> PathBuf {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_default()
}

fn config_path(client: AgentClient) -> PathBuf {
    let home = home();
    match client {
        AgentClient::ClaudeCode => home.join(".claude.json"),
        AgentClient::Codex => home.join(".codex/config.toml"),
        AgentClient::Antigravity => home.join(".gemini/config/mcp_config.json"),
    }
}

/// Finds a program in PATH and in the usual per-user install folders (apps started from
/// the desktop often get a minimal PATH).
fn find_program(name: &str) -> Option<PathBuf> {
    let home = home();
    let extra = [
        home.join(".local/bin"),
        home.join(".npm-global/bin"),
        home.join("bin"),
    ];
    std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .chain(extra)
        .flat_map(|dir| {
            let exe = dir.join(name);
            let win = dir.join(format!("{name}.exe"));
            let cmd = dir.join(format!("{name}.cmd"));
            [exe, win, cmd]
        })
        .find(|p| p.is_file())
}

fn installed(client: AgentClient) -> bool {
    match client {
        AgentClient::ClaudeCode => find_program("claude").is_some() || config_path(client).exists(),
        AgentClient::Codex => find_program("codex").is_some() || home().join(".codex").is_dir(),
        AgentClient::Antigravity => {
            home().join(".gemini").is_dir() || find_program("antigravity").is_some()
        }
    }
}

fn bearer(token: &str) -> String {
    format!("Bearer {token}")
}

pub fn manual(client: AgentClient, url: &str, token: &str) -> String {
    match client {
        AgentClient::ClaudeCode => format!(
            "claude mcp add --scope user --transport http {SERVER_NAME} {url} --header 'Authorization: {}'",
            bearer(token)
        ),
        AgentClient::Codex => format!(
            "[mcp_servers.{SERVER_NAME}]\nurl = \"{url}\"\nhttp_headers = {{ Authorization = \"{}\" }}\n",
            bearer(token)
        ),
        AgentClient::Antigravity => serde_json::to_string_pretty(&json!({
            "mcpServers": { SERVER_NAME: { "serverUrl": url, "headers": { "Authorization": bearer(token) } } }
        }))
        .unwrap_or_default(),
    }
}

/// True when `config` (the client's file contents) already has our entry with this token.
pub fn is_configured(client: AgentClient, config: &str, url: &str, token: &str) -> bool {
    let auth = bearer(token);
    match client {
        AgentClient::ClaudeCode => serde_json::from_str::<Value>(config).is_ok_and(|v| {
            let entry = &v["mcpServers"][SERVER_NAME];
            entry["url"] == url && entry["headers"]["Authorization"] == auth.as_str()
        }),
        AgentClient::Antigravity => serde_json::from_str::<Value>(config).is_ok_and(|v| {
            let entry = &v["mcpServers"][SERVER_NAME];
            entry["serverUrl"] == url && entry["headers"]["Authorization"] == auth.as_str()
        }),
        AgentClient::Codex => config.parse::<toml_edit::DocumentMut>().is_ok_and(|doc| {
            let entry = &doc["mcp_servers"][SERVER_NAME];
            entry["url"].as_str() == Some(url)
                && entry["http_headers"]["Authorization"].as_str() == Some(auth.as_str())
        }),
    }
}

pub fn status(client: AgentClient, url: &str, token: &str) -> AgentClientStatus {
    let path = config_path(client);
    let contents = fs::read_to_string(&path).unwrap_or_default();
    AgentClientStatus {
        client,
        installed: installed(client),
        configured: !token.is_empty() && is_configured(client, &contents, url, token),
        config_path: path.display().to_string(),
        manual: manual(client, url, token),
    }
}

/// Returns the new file contents with our entry added or replaced.
pub fn with_entry(client: AgentClient, config: &str, url: &str, token: &str) -> AppResult<String> {
    let invalid = |e: String| AppError::InvalidDocument(e);
    match client {
        AgentClient::Codex => {
            let mut doc = if config.trim().is_empty() {
                toml_edit::DocumentMut::new()
            } else {
                config
                    .parse::<toml_edit::DocumentMut>()
                    .map_err(|e| invalid(e.to_string()))?
            };
            if doc.get("mcp_servers").is_none() {
                let mut servers = toml_edit::Table::new();
                servers.set_implicit(true);
                doc["mcp_servers"] = toml_edit::Item::Table(servers);
            }
            let mut headers = toml_edit::InlineTable::new();
            headers.insert("Authorization", bearer(token).into());
            let mut entry = toml_edit::Table::new();
            entry["url"] = toml_edit::value(url);
            entry["http_headers"] = toml_edit::value(headers);
            doc["mcp_servers"][SERVER_NAME] = toml_edit::Item::Table(entry);
            Ok(doc.to_string())
        }
        AgentClient::Antigravity | AgentClient::ClaudeCode => {
            let mut root: Value = if config.trim().is_empty() {
                json!({})
            } else {
                serde_json::from_str(config).map_err(|e| invalid(e.to_string()))?
            };
            let entry = if client == AgentClient::Antigravity {
                json!({ "serverUrl": url, "headers": { "Authorization": bearer(token) } })
            } else {
                json!({ "type": "http", "url": url, "headers": { "Authorization": bearer(token) } })
            };
            let obj = root
                .as_object_mut()
                .ok_or_else(|| invalid("not a JSON object".into()))?;
            let servers = obj.entry("mcpServers").or_insert_with(|| json!({}));
            servers
                .as_object_mut()
                .ok_or_else(|| invalid("mcpServers is not an object".into()))?
                .insert(SERVER_NAME.into(), entry);
            Ok(serde_json::to_string_pretty(&root).map_err(|e| invalid(e.to_string()))? + "\n")
        }
    }
}

/// Adds or updates the `tiza` entry in the client's configuration.
pub fn install(client: AgentClient, url: &str, token: &str) -> AppResult<String> {
    if token.is_empty() {
        return Err(AppError::InvalidDocument(
            "enable the MCP server first".into(),
        ));
    }
    // Claude Code rewrites ~/.claude.json while running: use its own CLI when available.
    if client == AgentClient::ClaudeCode
        && let Some(claude) = find_program("claude")
    {
        let _ = std::process::Command::new(&claude)
            .args(["mcp", "remove", SERVER_NAME, "--scope", "user"])
            .output();
        let output = std::process::Command::new(&claude)
            .args([
                "mcp",
                "add",
                "--scope",
                "user",
                "--transport",
                "http",
                SERVER_NAME,
                url,
            ])
            .args(["--header", &format!("Authorization: {}", bearer(token))])
            .output()?;
        if !output.status.success() {
            return Err(AppError::Io(std::io::Error::other(
                String::from_utf8_lossy(&output.stderr).trim().to_string(),
            )));
        }
        return Ok(config_path(client).display().to_string());
    }
    let path = config_path(client);
    let current = fs::read_to_string(&path).unwrap_or_default();
    let updated = with_entry(client, &current, url, token)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    if !current.is_empty() {
        let backup = path.with_extension(format!(
            "{}tiza-backup",
            path.extension()
                .map(|e| format!("{}.", e.to_string_lossy()))
                .unwrap_or_default()
        ));
        fs::write(backup, &current)?;
    }
    let tmp = path.with_extension("tiza-tmp");
    fs::write(&tmp, updated)?;
    fs::rename(&tmp, &path)?;
    Ok(path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const URL: &str = "http://127.0.0.1:7457/mcp";

    #[test]
    fn codex_keeps_other_servers_and_comments() {
        let before = "# my config\nmodel = \"o3\"\n\n[mcp_servers.blender]\ncommand = \"uvx\"\n";
        let after = with_entry(AgentClient::Codex, before, URL, "abc").unwrap();
        assert!(after.contains("# my config"));
        assert!(after.contains("[mcp_servers.blender]"));
        assert!(after.contains("[mcp_servers.tiza]"));
        assert!(is_configured(AgentClient::Codex, &after, URL, "abc"));
        assert!(!is_configured(AgentClient::Codex, &after, URL, "other"));
        // Running it again replaces the entry instead of duplicating it.
        let again = with_entry(AgentClient::Codex, &after, URL, "new").unwrap();
        assert_eq!(again.matches("[mcp_servers.tiza]").count(), 1);
        assert!(is_configured(AgentClient::Codex, &again, URL, "new"));
    }

    #[test]
    fn json_clients_keep_other_servers() {
        let before = r#"{"mcpServers":{"blender":{"command":"uvx"}},"other":1}"#;
        for client in [AgentClient::Antigravity, AgentClient::ClaudeCode] {
            let after = with_entry(client, before, URL, "abc").unwrap();
            let v: Value = serde_json::from_str(&after).unwrap();
            assert_eq!(v["mcpServers"]["blender"]["command"], "uvx");
            assert_eq!(v["other"], 1);
            assert!(is_configured(client, &after, URL, "abc"));
        }
        assert!(with_entry(AgentClient::Antigravity, "", URL, "abc").is_ok());
        assert!(with_entry(AgentClient::Antigravity, "[1,2]", URL, "abc").is_err());
    }

    #[test]
    fn manual_snippets_contain_the_token() {
        for client in [
            AgentClient::ClaudeCode,
            AgentClient::Codex,
            AgentClient::Antigravity,
        ] {
            assert!(manual(client, URL, "tok123").contains("Bearer tok123"));
        }
    }
}
