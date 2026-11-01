//! Commands invoked from the frontend. All file work runs off the UI thread.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::archive;
use crate::assets::{AssetStore, ImportedAsset};
use crate::document::Presentation;
use crate::error::{AppError, AppResult};
use crate::sim::SimPages;

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

fn store(app: &AppHandle) -> tauri::State<'_, AssetStore> {
    app.state::<AssetStore>()
}

#[tauri::command]
pub async fn open_presentation(app: AppHandle, path: PathBuf) -> AppResult<Presentation> {
    blocking(move || archive::load(&path, Some(&store(&app)))).await
}

#[tauri::command]
pub async fn save_presentation(app: AppHandle, path: PathBuf, doc: Presentation) -> AppResult<()> {
    if !archive::has_tiza_extension(&path) {
        return Err(AppError::BadExtension);
    }
    blocking(move || archive::save(&path, &doc, Some(&store(&app)))).await
}

// ---------------------------------------------------------------- assets and import

/// Copies an image chosen in the open dialog into the asset store.
#[tauri::command]
pub async fn import_image(app: AppHandle, path: PathBuf) -> AppResult<ImportedAsset> {
    blocking(move || store(&app).import_file(&path)).await
}

/// Stores bytes produced by the UI (e.g. pictures extracted from an imported .pptx).
/// The body is the raw file; the `x-ext` header gives its extension.
#[tauri::command]
pub fn put_asset(app: AppHandle, request: tauri::ipc::Request<'_>) -> AppResult<String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::InvalidDocument("expected raw bytes".into()));
    };
    let ext = request
        .headers()
        .get("x-ext")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    store(&app).put(bytes, ext)
}

/// Raw bytes of an asset, for the web-style packers and the importers.
#[tauri::command]
pub fn read_asset(app: AppHandle, name: String) -> AppResult<tauri::ipc::Response> {
    Ok(tauri::ipc::Response::new(store(&app).read(&name)?))
}

const IMPORT_EXTENSIONS: &[&str] = &["pptx", "odp", "pdf", "ppt"];
const MAX_IMPORT_BYTES: u64 = 1024 * 1024 * 1024;

/// Reads a presentation to import (chosen by the user in the open dialog).
#[tauri::command]
pub async fn read_import_file(path: PathBuf) -> AppResult<tauri::ipc::Response> {
    let ok = path
        .extension()
        .is_some_and(|e| IMPORT_EXTENSIONS.iter().any(|x| e.eq_ignore_ascii_case(x)));
    if !ok {
        return Err(AppError::BadExtension);
    }
    blocking(move || {
        if fs::metadata(&path)?.len() > MAX_IMPORT_BYTES {
            return Err(AppError::TooLarge);
        }
        Ok(tauri::ipc::Response::new(fs::read(&path)?))
    })
    .await
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
    /// Written by Tiza itself just before restarting: restore without asking.
    #[serde(default)]
    pub auto_restore: bool,
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
        archive::save(&doc_path, &doc, Some(&store(&app)))?;
        let json = serde_json::to_vec(&info).map_err(std::io::Error::from)?;
        fs::write(info_path, json)?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn read_recovery(app: AppHandle) -> AppResult<Option<Recovery>> {
    let (doc_path, info_path) = recovery_paths(&app)?;
    let app = app.clone();
    blocking(move || {
        if !doc_path.is_file() {
            return Ok(None);
        }
        let info: RecoveryInfo = fs::read(&info_path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or(RecoveryInfo {
                path: None,
                auto_restore: false,
                saved_at: String::new(),
            });
        match archive::load(&doc_path, Some(&store(&app))) {
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

// ---------------------------------------------------------------- HTML simulations

/// Makes `html` available at `tizasim://localhost/<id>` and returns the id.
#[tauri::command]
pub fn register_sim(pages: State<'_, SimPages>, html: String, allow_network: bool) -> String {
    pages.register(html, allow_network)
}

const MAX_HTML_BYTES: u64 = 20 * 1024 * 1024;

/// Reads an .html file chosen by the user in the open dialog.
#[tauri::command]
pub async fn read_html_file(path: PathBuf) -> AppResult<String> {
    let is_html = path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("html") || e.eq_ignore_ascii_case("htm"));
    if !is_html {
        return Err(AppError::BadExtension);
    }
    blocking(move || {
        if fs::metadata(&path)?.len() > MAX_HTML_BYTES {
            return Err(AppError::TooLarge);
        }
        Ok(String::from_utf8_lossy(&fs::read(&path)?).into_owned())
    })
    .await
}

/// Graphics cards reported by the operating system (see `gpu.rs` for why not WebGL).
#[tauri::command]
pub async fn system_gpus() -> AppResult<crate::gpu::GpuReport> {
    blocking(|| Ok(crate::gpu::report())).await
}

// ---------------------------------------------------------------- GPU preference

#[tauri::command]
pub fn get_gpu_preference() -> crate::settings::GpuPreference {
    crate::settings::load().gpu
}

#[tauri::command]
pub fn set_gpu_preference(preference: crate::settings::GpuPreference) -> AppResult<()> {
    let mut settings = crate::settings::load();
    settings.gpu = preference;
    crate::settings::save(&settings)?;
    Ok(())
}

/// The UI is up: a launch with the chosen GPU worked (see `settings::apply_gpu_preference`).
#[tauri::command]
pub fn confirm_gpu_launch() {
    crate::settings::confirm_launch();
}

/// Restarts Tiza and returns `true`, except in development builds: there the UI is served
/// by the `tauri dev` server, which stops as soon as this process exits, so the new
/// process would show "connection refused". Returns `false` and the user restarts by hand.
#[tauri::command]
pub fn restart_app(app: AppHandle) -> bool {
    if cfg!(debug_assertions) {
        return false;
    }
    app.restart();
}

/// Reads a CSV/TSV/TXT file chosen by the user (tables). Files that aren't valid UTF-8
/// (e.g. saved by Excel on Windows) are read as Latin-1 so accents survive.
#[tauri::command]
pub async fn read_text_file(path: PathBuf) -> AppResult<String> {
    let ok = path.extension().is_some_and(|e| {
        ["csv", "tsv", "txt"]
            .iter()
            .any(|x| e.eq_ignore_ascii_case(x))
    });
    if !ok {
        return Err(AppError::BadExtension);
    }
    blocking(move || {
        if fs::metadata(&path)?.len() > MAX_HTML_BYTES {
            return Err(AppError::TooLarge);
        }
        Ok(decode_text(fs::read(&path)?))
    })
    .await
}

fn decode_text(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes).unwrap_or_else(|e| e.into_bytes().iter().map(|&b| b as char).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_utf8_and_latin1() {
        assert_eq!(
            decode_text("Física;Ação".as_bytes().to_vec()),
            "Física;Ação"
        );
        assert_eq!(decode_text(vec![b'F', 0xed, b's']), "Fís");
    }
}
