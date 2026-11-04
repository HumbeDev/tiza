//! Local HTTP server for videos. WebKitGTK's media player can't read custom protocols, so
//! instead of loading whole videos into memory (a blob: URL) they are served from
//! 127.0.0.1 with HTTP ranges. Each run uses a random token in the URL, and only names of
//! the session's assets are served.

use std::sync::Mutex;

use axum::{
    Router,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, Request, Response, StatusCode, header},
    routing::get,
};
use tauri::{AppHandle, Manager};

use crate::assets::AssetStore;

#[derive(Default)]
pub struct MediaServer {
    /// `http://127.0.0.1:<port>/<token>` once listening.
    base: Mutex<Option<String>>,
}

impl MediaServer {
    pub fn base(&self) -> Option<String> {
        self.base.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }
}

/// Starts the server on a free port (desktop app start).
pub fn start(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let Ok(listener) = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await else {
            return;
        };
        let Ok(addr) = listener.local_addr() else {
            return;
        };
        let token = uuid::Uuid::new_v4().simple().to_string();
        let router = Router::new()
            .route("/{token}/{name}", get(serve))
            .with_state((app.clone(), token.clone()));
        *app.state::<MediaServer>()
            .base
            .lock()
            .unwrap_or_else(|e| e.into_inner()) =
            Some(format!("http://127.0.0.1:{}/{token}", addr.port()));
        let _ = axum::serve(listener, router).await;
    });
}

async fn serve(
    State((app, token)): State<(AppHandle, String)>,
    Path((given, name)): Path<(String, String)>,
    headers: HeaderMap,
) -> Response<Body> {
    let not_found = || {
        Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Body::empty())
            .unwrap_or_default()
    };
    if given != token {
        return not_found();
    }
    let store = app.state::<AssetStore>();
    let Some(path) = store.path(&name) else {
        return not_found();
    };

    // Ranges (what players use to read and seek) are answered from the asset store.
    if let Some(range) = headers.get(header::RANGE) {
        let request = Request::builder()
            .uri(format!("/{name}"))
            .header(header::RANGE, range)
            .body(Vec::new())
            .unwrap_or_default();
        return store.respond(&request).map(Body::from);
    }

    // A whole-file request is streamed, never read into memory at once.
    let Ok(file) = tokio::fs::File::open(&path).await else {
        return not_found();
    };
    let len = file.metadata().await.map(|m| m.len()).unwrap_or(0);
    let mime = crate::assets::mime(name.rsplit('.').next().unwrap_or_default())
        .unwrap_or("application/octet-stream");
    Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, len)
        .header(header::ACCEPT_RANGES, "bytes")
        .header("X-Content-Type-Options", "nosniff")
        .body(Body::from_stream(tokio_util::io::ReaderStream::new(file)))
        .unwrap_or_default()
}

/// Base URL for videos (`<base>/<asset name>`), or null if the server isn't running.
#[tauri::command]
pub fn media_base(server: tauri::State<'_, MediaServer>) -> Option<String> {
    server.base()
}
