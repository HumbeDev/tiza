//! Commands invoked from the frontend. All file work runs off the UI thread.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::archive;
use crate::document::Presentation;
use crate::error::{AppError, AppResult};

/// Version of the Rust core, shown in the UI to confirm the frontend↔backend bridge works.
#[tauri::command]
pub fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn open_presentation(path: PathBuf) -> AppResult<Presentation> {
    blocking(move || archive::load(&path)).await
}

#[tauri::command]
pub async fn save_presentation(path: PathBuf, doc: Presentation) -> AppResult<()> {
    if !archive::has_tiza_extension(&path) {
        return Err(AppError::BadExtension);
    }
    blocking(move || archive::save(&path, &doc)).await
}

/// A `.tiza` path passed on the command line (e.g. double-clicking a file).
#[tauri::command]
pub fn startup_file() -> Option<PathBuf> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| archive::has_tiza_extension(p) && p.is_file())
}

// ---------------------------------------------------------------- crash recovery

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryInfo {
    /// File the unsaved changes belong to, if it had been saved before.
    pub path: Option<PathBuf>,
    /// ISO 8601 time of the autosave.
    pub saved_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recovery {
    pub doc: Presentation,
    pub info: RecoveryInfo,
}

fn recovery_paths(app: &AppHandle) -> AppResult<(PathBuf, PathBuf)> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?
        .join("recovery");
    Ok((dir.join("session.tiza"), dir.join("session.json")))
}

#[tauri::command]
pub async fn write_recovery(
    app: AppHandle,
    doc: Presentation,
    info: RecoveryInfo,
) -> AppResult<()> {
    let (doc_path, info_path) = recovery_paths(&app)?;
    blocking(move || {
        if let Some(dir) = doc_path.parent() {
            fs::create_dir_all(dir)?;
        }
        archive::save(&doc_path, &doc)?;
        let json = serde_json::to_vec(&info).map_err(std::io::Error::from)?;
        fs::write(info_path, json)?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn read_recovery(app: AppHandle) -> AppResult<Option<Recovery>> {
    let (doc_path, info_path) = recovery_paths(&app)?;
    blocking(move || {
        if !doc_path.is_file() {
            return Ok(None);
        }
        let info: RecoveryInfo = fs::read(&info_path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or(RecoveryInfo {
                path: None,
                saved_at: String::new(),
            });
        match archive::load(&doc_path) {
            Ok(doc) => Ok(Some(Recovery { doc, info })),
            // A broken recovery file is useless; drop it instead of failing every startup.
            Err(_) => {
                let _ = fs::remove_file(&doc_path);
                Ok(None)
            }
        }
    })
    .await
}

#[tauri::command]
pub async fn clear_recovery(app: AppHandle) -> AppResult<()> {
    let (doc_path, info_path) = recovery_paths(&app)?;
    blocking(move || {
        for path in [doc_path, info_path] {
            match fs::remove_file(path) {
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(e.into()),
                _ => {}
            }
        }
        Ok(())
    })
    .await
}
