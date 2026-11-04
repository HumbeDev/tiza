//! Forwards tool calls to the editor window and waits for its answer. The editor's store
//! is the single source of truth: tools run there through the same actions as the UI.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

const TIMEOUT: Duration = Duration::from_secs(30);
/// Exports render every slide; long presentations with video take a while.
const EXPORT_TIMEOUT: Duration = Duration::from_secs(600);

type Reply = Result<Value, String>;

#[derive(Clone, Default)]
pub struct Bridge(Arc<Inner>);

#[derive(Default)]
struct Inner {
    app: Mutex<Option<AppHandle>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<Reply>>>,
    next: AtomicU64,
}

impl Bridge {
    pub fn attach(&self, app: AppHandle) {
        *self.0.app.lock().unwrap_or_else(|e| e.into_inner()) = Some(app);
    }

    pub fn app(&self) -> Result<AppHandle, String> {
        self.0
            .app
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
            .ok_or_else(|| "Tiza is still starting".to_string())
    }

    /// Runs `tool` in the editor window with `args`; resolves with its JSON result.
    pub async fn call(&self, tool: &str, args: Value) -> Reply {
        let app = self.app()?;
        let id = self.0.next.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.0
            .pending
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(id, tx);
        let payload = json!({ "id": id, "tool": tool, "args": args });
        if let Err(e) = app.emit_to("main", "mcp:request", payload) {
            self.forget(id);
            return Err(format!("could not reach the editor: {e}"));
        }
        let timeout = if tool == "export_presentation" {
            EXPORT_TIMEOUT
        } else {
            TIMEOUT
        };
        match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(reply)) => reply,
            _ => {
                self.forget(id);
                Err("Tiza did not answer in time (is a dialog open in the app?)".into())
            }
        }
    }

    /// Called by the editor (command `mcp_respond`) with the result of request `id`.
    pub fn respond(&self, id: u64, reply: Reply) {
        if let Some(tx) = self
            .0
            .pending
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&id)
        {
            let _ = tx.send(reply);
        }
    }

    fn forget(&self, id: u64) {
        self.0
            .pending
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&id);
    }
}
